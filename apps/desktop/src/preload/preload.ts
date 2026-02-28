import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("repoRefactor", {
  ping: () => ipcRenderer.invoke("ping"),
});
