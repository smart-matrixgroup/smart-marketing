const crypto = require('crypto');
const fs = require('fs');
const db = require('./db');
const { enc, dec } = require('./crypto');
const cfg = () => ({ id: process.env.GOOGLE_CLIENT_ID, secret: process.env.GOOGLE_CLIENT_SECRET, redirect: `http://127.0.0.1:${process.env.PORT || 4010}/oauth/google/callback` });
const configured = () => !!(cfg().id && cfg().secret);
const states = new Map();
function authUrl(accountId) {
  const c = cfg(), s = crypto.randomBytes(16).toString('hex');
  states.set(s, { accountId, t: Date.now() });
  return 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({ client_id: c.id, redirect_uri: c.redirect, response_type: 'code', access_type: 'offline', prompt: 'consent', scope: 'openid email https://www.googleapis.com/auth/gmail.send', state: s });
}
async function callback(code, state) {
  const st = states.get(state);
  if (!st || Date.now() - st.t > 600000) throw new Error('Invalid or expired sign-in request');
  states.delete(state);
  const c = cfg();
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code, client_id: c.id, client_secret: c.secret, redirect_uri: c.redirect, grant_type: 'authorization_code' }) });
  const j = await r.json();
  if (!j.refresh_token) throw new Error(j.error_description || 'Google did not return a refresh token');
  const u = await (await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: 'Bearer ' + j.access_token } })).json();
  db.prepare("UPDATE accounts SET status='connected',demo=0,identifier=?,refresh_enc=?,expires_at=NULL WHERE id=?").run(u.email, enc(j.refresh_token), st.accountId);
}
async function accessToken(account) {
  const c = cfg();
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: c.id, client_secret: c.secret, refresh_token: dec(account.refresh_enc), grant_type: 'refresh_token' }) });
  const j = await r.json();
  if (!j.access_token) { db.prepare("UPDATE accounts SET status='expired' WHERE id=?").run(account.id); throw new Error('Gmail connection expired. Reconnect the account.'); }
  return j.access_token;
}
function mime({ to, subject, body, files }) {
  const b = 'smart' + Date.now();
  let m = `To: ${to}\r\nSubject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=\r\nMIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary="${b}"\r\n\r\n--${b}\r\nContent-Type: text/plain; charset="UTF-8"\r\nContent-Transfer-Encoding: base64\r\n\r\n${Buffer.from(body).toString('base64')}\r\n`;
  for (const f of files) m += `--${b}\r\nContent-Type: ${f.mime}; name="${f.name}"\r\nContent-Disposition: attachment; filename="${f.name}"\r\nContent-Transfer-Encoding: base64\r\n\r\n${fs.readFileSync(f.path).toString('base64')}\r\n`;
  return Buffer.from(m + `--${b}--`).toString('base64url');
}
async function sendMail(account, mail) {
  if (!configured() || !account.refresh_enc) throw new Error('Gmail is not connected through Google OAuth.');
  const t = await accessToken(account);
  const r = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', { method: 'POST', headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: JSON.stringify({ raw: mime(mail) }) });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error?.message || 'Gmail rejected the message');
}
module.exports = { configured, authUrl, callback, sendMail };
