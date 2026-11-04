const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const db = require('./db');
let key;
function getKey() {
  if (key) return key;
  if (process.env.SMART_DATA_KEY) return (key = Buffer.from(process.env.SMART_DATA_KEY, 'hex'));
  const f = path.join(db.dir, '.devkey'); // dev fallback only (Electron supplies a DPAPI-protected key)
  if (!fs.existsSync(f)) fs.writeFileSync(f, crypto.randomBytes(32).toString('hex'));
  return (key = Buffer.from(fs.readFileSync(f, 'utf8'), 'hex'));
}
exports.enc = (text) => {
  if (!text) return null;
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const data = Buffer.concat([c.update(text, 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), data]).toString('base64');
};
exports.dec = (b64) => {
  if (!b64) return null;
  const b = Buffer.from(b64, 'base64');
  const d = crypto.createDecipheriv('aes-256-gcm', getKey(), b.subarray(0, 12));
  d.setAuthTag(b.subarray(12, 28));
  return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8');
};
