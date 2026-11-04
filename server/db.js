// SQLite via sql.js (pure WebAssembly): no Python, no C++ build tools, no native modules.
// Exposes a small better-sqlite3-style API: prepare(sql).get/all/run, exec. Data is saved to smart.sqlite.
const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const dir = process.env.SMART_DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(path.join(dir, 'uploads'), { recursive: true });
const file = path.join(dir, 'smart.sqlite');
let sdb, timer;
const saveNow = () => { if (sdb) fs.writeFileSync(file, Buffer.from(sdb.export())); };
const save = () => { clearTimeout(timer); timer = setTimeout(saveNow, 250); };
process.on('exit', saveNow);

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, username TEXT UNIQUE, pass_hash TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY, user_id INTEGER, expires_at INTEGER);
CREATE TABLE IF NOT EXISTS accounts(id INTEGER PRIMARY KEY, platform TEXT, name TEXT, identifier TEXT, external_id TEXT, status TEXT DEFAULT 'disconnected', demo INTEGER DEFAULT 0, token_enc TEXT, refresh_enc TEXT, expires_at INTEGER, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS posts(id INTEGER PRIMARY KEY, title TEXT, caption TEXT, url TEXT, media TEXT DEFAULT '[]', targets TEXT DEFAULT '[]', status TEXT DEFAULT 'draft', scheduled_at TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS results(id INTEGER PRIMARY KEY, post_id INTEGER, account_id INTEGER, account_name TEXT, platform TEXT, status TEXT, message TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
`;
const clean = (p) => p.map((v) => (v === undefined ? null : v));
const db = {
  dir,
  exec(sql) { sdb.exec(sql); save(); },
  pragma() {},
  prepare(sql) {
    return {
      get(...p) { const st = sdb.prepare(sql); try { st.bind(clean(p)); return st.step() ? st.getAsObject() : undefined; } finally { st.free(); } },
      all(...p) { const st = sdb.prepare(sql), rows = []; try { st.bind(clean(p)); while (st.step()) rows.push(st.getAsObject()); return rows; } finally { st.free(); } },
      run(...p) {
        sdb.run(sql, clean(p));
        const changes = sdb.getRowsModified();
        const lastInsertRowid = sdb.exec('SELECT last_insert_rowid()')[0].values[0][0];
        save();
        return { changes, lastInsertRowid };
      }
    };
  }
};
db.ready = initSqlJs().then((SQL) => {
  sdb = fs.existsSync(file) ? new SQL.Database(fs.readFileSync(file)) : new SQL.Database();
  sdb.exec(SCHEMA);
  saveNow();
});
module.exports = db;
