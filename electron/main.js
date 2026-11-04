const { app, BrowserWindow, ipcMain, safeStorage, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const dev = !!process.env.ELECTRON_DEV;

function loadEnv() {
  require('dotenv').config({ path: [path.join(app.getPath('userData'), '.env'), path.join(__dirname, '..', '.env')] });
}
// Data-encryption key is generated once and protected with Windows DPAPI via safeStorage.
function dataKey() {
  const f = path.join(app.getPath('userData'), 'data.key');
  const ok = safeStorage.isEncryptionAvailable();
  if (fs.existsSync(f)) { const b = fs.readFileSync(f); return ok ? safeStorage.decryptString(b) : b.toString('utf8'); }
  const k = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(f, ok ? safeStorage.encryptString(k) : k);
  return k;
}
let win;
function createWindow() {
  win = new BrowserWindow({
    width: 1400, height: 880, minWidth: 1100, minHeight: 700, frame: false, backgroundColor: '#0F1B3D',
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, webviewTag: true }
  });
  win.setMenuBarVisibility(false);
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\//.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  dev ? win.loadURL('http://localhost:5173') : win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  win.on('maximize', () => win.webContents.send('win:state', true));
  win.on('unmaximize', () => win.webContents.send('win:state', false));
}
app.on('web-contents-created', (_e, c) => {
  if (c.getType() === 'webview') c.setWindowOpenHandler(({ url }) => { if (/^https:\/\//.test(url)) shell.openExternal(url); return { action: 'deny' }; });
});
const lock = app.requestSingleInstanceLock();
if (!lock) app.quit();
app.whenReady().then(() => {
  loadEnv();
  process.env.SMART_DATA_KEY = dataKey();
  process.env.SMART_DATA_DIR = path.join(app.getPath('userData'), 'data');
  require("../server").start().catch((e) => { console.error(e); app.quit(); });
  ipcMain.on('win:min', () => win.minimize());
  ipcMain.on('win:max', () => (win.isMaximized() ? win.unmaximize() : win.maximize()));
  ipcMain.on('win:close', () => win.close());
  ipcMain.on('open:url', (_e, url) => { if (/^https:\/\//.test(url)) shell.openExternal(url); });
  createWindow();
});
app.on('window-all-closed', () => app.quit());
