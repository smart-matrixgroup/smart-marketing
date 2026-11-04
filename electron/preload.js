const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('smart', {
  min: () => ipcRenderer.send('win:min'),
  max: () => ipcRenderer.send('win:max'),
  close: () => ipcRenderer.send('win:close'),
  onMax: (cb) => ipcRenderer.on('win:state', (_e, v) => cb(v)),
  openUrl: (url) => ipcRenderer.send('open:url', url)
});
