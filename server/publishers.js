const fs = require('fs');
const db = require('./db');
const { dec } = require('./crypto');
const GRAPH = 'https://graph.facebook.com/v19.0';
const RULES = {
  instagram: { max: 2200, need: 'media', label: 'Instagram' },
  tiktok: { max: 2200, need: 'video', label: 'TikTok' },
  youtube: { max: 5000, need: 'video', label: 'YouTube' },
  linkedin: { max: 3000, label: 'LinkedIn' },
  facebook: { max: 63000, label: 'Facebook' }
};
const NOTES = {
  instagram: 'Instagram publishing needs a Business/Creator account linked to a Facebook Page and Meta app review (instagram_content_publish).',
  tiktok: 'TikTok publishing needs a TikTok for Developers app with Content Posting API approval.',
  youtube: 'YouTube uploads need a Google Cloud project with YouTube Data API enabled and an OAuth consent screen review.',
  linkedin: 'LinkedIn posting needs a LinkedIn developer app with the Share on LinkedIn / Community Management product approved.',
  facebook: 'Add a Page ID and Page access token (or complete Meta app review) to publish.'
};
const buildText = (post, caption) => [post.title, caption, post.url].filter(Boolean).join('\n\n');

async function facebook(account, post, text) {
  const id = account.external_id, token = account.token;
  const call = async (p, body) => { const r = await fetch(`${GRAPH}/${id}/${p}`, { method: 'POST', body }); const j = await r.json(); if (j.error) throw new Error(j.error.message); return j; };
  const blob = (m) => new Blob([fs.readFileSync(m.path)], { type: m.mime });
  const video = post.media.find((m) => m.mime.startsWith('video/'));
  const imgs = post.media.filter((m) => m.mime.startsWith('image/'));
  const fd = (o) => { const f = new FormData(); f.append('access_token', token); Object.entries(o).forEach(([k, v]) => f.append(k, v)); return f; };
  if (video) { const f = fd({ description: text }); f.append('source', blob(video), video.name); return call('videos', f); }
  if (imgs.length === 1) { const f = fd({ caption: text }); f.append('source', blob(imgs[0]), imgs[0].name); return call('photos', f); }
  if (imgs.length > 1) {
    const ids = [];
    for (const m of imgs) { const f = fd({ published: 'false' }); f.append('source', blob(m), m.name); ids.push((await call('photos', f)).id); }
    const f = fd({ message: text }); ids.forEach((v, i) => f.append(`attached_media[${i}]`, JSON.stringify({ media_fbid: v })));
    return call('feed', f);
  }
  return call('feed', fd({ message: text }));
}

async function publishAccount(account, post, caption) {
  const p = account.platform, rule = RULES[p], text = buildText(post, caption);
  if (account.status !== 'connected') return { status: 'failed', message: `Account is ${account.status}. Reconnect it first.` };
  if (p === 'whatsapp') return { status: 'manual', message: 'WhatsApp Status cannot be published through the official API. Share it manually.' };
  if (p === 'gmail') return { status: 'failed', message: 'Gmail is an email service. Use the email form in the Gmail account workspace.' };
  if (rule?.need === 'media' && !post.media.length) return { status: 'failed', message: `${rule.label} requires an image or video.` };
  if (rule?.need === 'video' && !post.media.some((m) => m.mime.startsWith('video/'))) return { status: 'failed', message: `${rule.label} requires a video.` };
  if (rule && text.length > rule.max) return { status: 'failed', message: `Text is ${text.length} characters; ${rule.label} allows ${rule.max}.` };
  if (p === 'facebook' && account.token && account.external_id && !account.demo) {
    const j = await facebook(account, post, text);
    return { status: 'published', message: `Published (id ${j.id || j.post_id})` };
  }
  if (account.demo || process.env.DEMO_MODE === 'true' && !account.token) return { status: 'demo', message: 'DEMO mode: simulated only. Nothing was posted.' };
  return { status: 'config_required', message: NOTES[p] || 'Platform credentials are required.' };
}

const parsePost = (r) => r && { ...r, media: JSON.parse(r.media || '[]'), targets: JSON.parse(r.targets || '[]'), scheduledAt: r.scheduled_at };
function latest(postId) {
  const m = {};
  db.prepare('SELECT * FROM results WHERE post_id=? ORDER BY id').all(postId).forEach((r) => (m[r.account_id] = r));
  return m;
}
async function publishPost(id, { onlyFailed } = {}) {
  const post = parsePost(db.prepare('SELECT * FROM posts WHERE id=?').get(id));
  let targets = post.targets;
  if (onlyFailed) { const l = latest(id); targets = targets.filter((t) => ['failed', 'config_required'].includes(l[t.accountId]?.status)); }
  const ins = db.prepare('INSERT INTO results(post_id,account_id,account_name,platform,status,message) VALUES(?,?,?,?,?,?)');
  for (const t of targets) {
    const a = db.prepare('SELECT * FROM accounts WHERE id=?').get(t.accountId);
    if (!a) { ins.run(id, t.accountId, 'Removed account', '', 'failed', 'Account was removed.'); continue; }
    let out;
    try { out = await publishAccount({ ...a, token: dec(a.token_enc) }, post, t.caption || post.caption); }
    catch (e) { out = { status: 'failed', message: e.message }; }
    ins.run(id, a.id, a.name, a.platform, out.status, out.message);
  }
  const l = Object.values(latest(id));
  const bad = l.some((r) => ['failed', 'config_required'].includes(r.status));
  db.prepare('UPDATE posts SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(bad ? 'failed' : 'published', id);
}
module.exports = { publishPost, parsePost, RULES };
