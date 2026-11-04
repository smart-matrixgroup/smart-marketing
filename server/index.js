const express = require('express');
const cors = require('cors');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const db = require('./db');
const { enc } = require('./crypto');
const google = require('./google');
const { publishPost, parsePost } = require('./publishers');

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const hashPw = (pw) => { const salt = crypto.randomBytes(16); return salt.toString('hex') + ':' + crypto.scryptSync(pw, salt, 64).toString('hex'); };
const checkPw = (pw, stored) => { const [s, h] = stored.split(':'); return crypto.timingSafeEqual(crypto.scryptSync(pw, Buffer.from(s, 'hex'), 64), Buffer.from(h, 'hex')); };
const demo = () => process.env.DEMO_MODE === 'true';
const h = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((e) => res.status(500).json({ error: e.message }));
const publicAcc = (a) => ({ id: a.id, platform: a.platform, name: a.name, identifier: a.identifier, externalId: a.external_id, demo: !!a.demo, hasToken: !!(a.token_enc || a.refresh_enc),
  status: a.status === 'connected' && a.expires_at && a.expires_at < Date.now() ? 'expired' : a.status });

async function start() {
  await db.ready;
  const port = +process.env.PORT || 4010;
  if (!db.prepare('SELECT 1 FROM users').get()) db.prepare('INSERT INTO users(username,pass_hash) VALUES(?,?)').run(process.env.SMART_ADMIN_USER || 'admin', hashPw(process.env.SMART_ADMIN_PASSWORD || 'ChangeMe@123'));
  if (demo() && !db.prepare('SELECT 1 FROM accounts').get()) {
    const i = db.prepare("INSERT INTO accounts(platform,name,identifier,status,demo) VALUES(?,?,?,?,1)");
    [['whatsapp', 'WhatsApp Account 01', '+94 77 000 0001', 'connected'], ['whatsapp', 'WhatsApp Account 02', '+94 77 000 0002', 'connected'],
     ['gmail', 'marketing@company.com', 'marketing@company.com', 'connected'], ['gmail', 'info@company.com', 'info@company.com', 'disconnected'],
     ['facebook', 'Facebook Page 01', 'SMART Page 1', 'connected'], ['facebook', 'Facebook Page 02', 'SMART Page 2', 'expired'], ['instagram', 'Instagram Account 01', '@smart_01', 'connected']].forEach((r) => i.run(...r));
  }
  const app = express();
  app.use(cors({ origin: (o, cb) => cb(null, !o || o === 'null' || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o)) }));
  app.use(express.json({ limit: '2mb' }));
  const upDir = path.join(db.dir, 'uploads');
  app.use('/uploads', express.static(upDir));
  const upload = multer({ storage: multer.diskStorage({ destination: upDir, filename: (_r, f, cb) => cb(null, crypto.randomBytes(8).toString('hex') + path.extname(f.originalname)) }), limits: { fileSize: 512 * 1024 * 1024 } });

  app.get('/oauth/google/callback', h(async (req, res) => {
    try { await google.callback(req.query.code, req.query.state); res.send('<h2>Account connected.</h2><p>You can close this window and return to SMART Social Manager.</p>'); }
    catch (e) { res.status(400).send('<h2>Connection failed</h2><p>' + String(e.message).replace(/</g, '&lt;') + '</p>'); }
  }));

  const api = express.Router();
  const fails = new Map();
  api.get('/config', (_q, r) => r.json({ demo: demo(), googleConfigured: google.configured() }));
  api.post('/login', h((req, res) => {
    const ip = req.ip, f = fails.get(ip) || { n: 0, t: Date.now() };
    if (f.n >= 8 && Date.now() - f.t < 900000) return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
    const { username, password, remember } = req.body;
    const u = db.prepare('SELECT * FROM users WHERE username=?').get(String(username || ''));
    if (!u || !checkPw(String(password || ''), u.pass_hash)) { fails.set(ip, { n: f.n + 1, t: Date.now() }); return res.status(401).json({ error: 'Incorrect username or password.' }); }
    fails.delete(ip);
    const token = crypto.randomBytes(32).toString('hex');
    db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(sha(token), u.id, Date.now() + (remember ? 30 : 0.5) * 864e5);
    res.json({ token, user: { username: u.username } });
  }));
  api.use((req, res, next) => {
    const t = (req.headers.authorization || '').replace('Bearer ', '');
    const s = t && db.prepare('SELECT s.*,u.username FROM sessions s JOIN users u ON u.id=s.user_id WHERE token_hash=?').get(sha(t));
    if (!s || s.expires_at < Date.now()) return res.status(401).json({ error: 'Session expired. Please sign in again.' });
    req.session = { ...s, hash: sha(t) }; next();
  });
  api.get('/me', (req, res) => res.json({ user: { username: req.session.username } }));
  api.post('/logout', (req, res) => { db.prepare('DELETE FROM sessions WHERE token_hash=?').run(req.session.hash); res.json({ ok: true }); });

  // ---- accounts
  api.get('/accounts', (_q, res) => res.json(db.prepare('SELECT * FROM accounts ORDER BY id').all().map(publicAcc)));
  api.post('/accounts', h((req, res) => {
    const { platform, name, identifier, externalId, token } = req.body;
    if (!platform || !name) return res.status(400).json({ error: 'Platform and name are required.' });
    const wa = platform === 'whatsapp', real = !!token, ok = real || wa || demo();
    const r = db.prepare('INSERT INTO accounts(platform,name,identifier,external_id,status,demo,token_enc) VALUES(?,?,?,?,?,?,?)').run(platform, name, identifier || '', externalId || '', ok ? 'connected' : 'disconnected', (real || wa) ? 0 : demo() ? 1 : 0, enc(token));
    res.json(publicAcc(db.prepare('SELECT * FROM accounts WHERE id=?').get(r.lastInsertRowid)));
  }));
  api.post('/accounts/:id/connect', h((req, res) => {
    const a = db.prepare('SELECT * FROM accounts WHERE id=?').get(req.params.id);
    if (!a) return res.status(404).json({ error: 'Account not found.' });
    const { token, externalId } = req.body;
    if (token) { db.prepare("UPDATE accounts SET token_enc=?,external_id=COALESCE(NULLIF(?,''),external_id),status='connected',demo=0,expires_at=NULL WHERE id=?").run(enc(token), externalId || '', a.id); }
    else if (a.platform === 'gmail' && google.configured()) return res.json({ authUrl: google.authUrl(a.id) });
    else if (demo()) db.prepare("UPDATE accounts SET status='connected',demo=1,expires_at=NULL WHERE id=?").run(a.id);
    else return res.status(400).json({ error: a.platform === 'gmail' ? 'Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env to connect Gmail.' : 'Enter an access token, or complete the platform OAuth setup described in the README.' });
    res.json(publicAcc(db.prepare('SELECT * FROM accounts WHERE id=?').get(a.id)));
  }));
  api.post('/accounts/:id/disconnect', (req, res) => { db.prepare("UPDATE accounts SET status='disconnected',token_enc=NULL,refresh_enc=NULL WHERE id=?").run(req.params.id); res.json({ ok: true }); });
  api.delete('/accounts/:id', (req, res) => { db.prepare('DELETE FROM accounts WHERE id=?').run(req.params.id); res.json({ ok: true }); });

  // ---- uploads
  api.post('/upload', upload.array('files', 20), (req, res) => res.json(req.files.map((f) => ({ name: f.originalname, path: f.path, mime: f.mimetype, size: f.size }))));

  // ---- posts
  const postOut = (r) => ({ ...parsePost(r), results: db.prepare('SELECT * FROM results WHERE post_id=? ORDER BY id').all(r.id) });
  api.get('/posts', (req, res) => {
    const s = req.query.status;
    const rows = s && s !== 'all' ? db.prepare('SELECT * FROM posts WHERE status=? ORDER BY id DESC').all(s) : db.prepare('SELECT * FROM posts ORDER BY id DESC').all();
    res.json(rows.map(postOut));
  });
  const fields = (b) => [b.title || '', b.caption || '', b.url || '', JSON.stringify(b.media || []), JSON.stringify(b.targets || []), b.status || 'draft', b.scheduledAt || null];
  api.post('/posts', (req, res) => {
    const r = db.prepare('INSERT INTO posts(title,caption,url,media,targets,status,scheduled_at) VALUES(?,?,?,?,?,?,?)').run(...fields(req.body));
    res.json(postOut(db.prepare('SELECT * FROM posts WHERE id=?').get(r.lastInsertRowid)));
  });
  api.put('/posts/:id', (req, res) => {
    db.prepare('UPDATE posts SET title=?,caption=?,url=?,media=?,targets=?,status=?,scheduled_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(...fields(req.body), req.params.id);
    res.json(postOut(db.prepare('SELECT * FROM posts WHERE id=?').get(req.params.id)));
  });
  api.delete('/posts/:id', (req, res) => {
    const p = db.prepare('SELECT status FROM posts WHERE id=?').get(req.params.id);
    if (p && !['draft', 'scheduled'].includes(p.status)) return res.status(400).json({ error: 'Only drafts and scheduled posts can be deleted. Published history is kept.' });
    db.prepare('DELETE FROM posts WHERE id=?').run(req.params.id); res.json({ ok: true });
  });
  api.post('/posts/:id/publish', h(async (req, res) => {
    await publishPost(+req.params.id, { onlyFailed: !!req.body.onlyFailed });
    res.json(postOut(db.prepare('SELECT * FROM posts WHERE id=?').get(req.params.id)));
  }));

  // ---- email (Gmail)
  api.post('/email/send', h(async (req, res) => {
    const { accountId, to, subject, body, files = [] } = req.body;
    const a = db.prepare("SELECT * FROM accounts WHERE id=? AND platform='gmail'").get(accountId);
    if (!a || a.status !== 'connected') return res.status(400).json({ error: 'Select a connected Gmail account.' });
    if (!to || !subject) return res.status(400).json({ error: 'Recipient and subject are required.' });
    if (a.demo) return res.json({ status: 'demo', message: 'DEMO mode: email was NOT sent.' });
    await google.sendMail(a, { to, subject, body: body || '', files });
    res.json({ status: 'sent', message: 'Email sent through the Gmail API.' });
  }));
  app.use('/api', api);

  setInterval(async () => {
    const due = db.prepare("SELECT id FROM posts WHERE status='scheduled' AND scheduled_at<=?").all(new Date().toISOString());
    for (const p of due) { db.prepare("UPDATE posts SET status='publishing' WHERE id=?").run(p.id); await publishPost(p.id).catch(() => db.prepare("UPDATE posts SET status='failed' WHERE id=?").run(p.id)); }
  }, 30000);
  app.listen(port, '127.0.0.1', () => console.log('SMART API on ' + port));
}
module.exports = { start };
if (require.main === module) { require('dotenv').config(); start(); }
