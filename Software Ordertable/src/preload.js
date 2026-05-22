const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("ordertable", {
  activateLicense: (payload) => ipcRenderer.invoke("activate-license", payload),
  openExternal: (url) => ipcRenderer.invoke("open-external", url),
  onActivationState: (callback) => ipcRenderer.on("activation-state", (_event, state) => callback(state))
});

