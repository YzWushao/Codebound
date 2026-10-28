const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('codebound', Object.freeze({
  platform:'desktop',
  loadSave:()=>ipcRenderer.invoke('save:load'),
  saveSave:value=>ipcRenderer.invoke('save:write',value),
  checkUpdates:()=>ipcRenderer.invoke('updates:check'),
  onFlush:handler=>ipcRenderer.on('save:flush',()=>Promise.resolve().then(handler).finally(()=>ipcRenderer.send('save:flushed')))
}));
