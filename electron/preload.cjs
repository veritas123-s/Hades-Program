const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("veritas", {
  platform: process.platform,
  call: (action, payload) =>
    ipcRenderer.invoke("veritas:call", action, payload),
  subscribe: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on("veritas:state", listener);
    return () => ipcRenderer.removeListener("veritas:state", listener);
  },
});
