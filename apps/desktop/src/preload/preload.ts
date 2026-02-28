import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("repoRefactor", {
  selectRepo: () => ipcRenderer.invoke("dialog:openDirectory"),
  scan: (repoPath: string) => ipcRenderer.invoke("pipeline:scan", repoPath),
  plan: (runId: string) => ipcRenderer.invoke("pipeline:plan", runId),
  apply: () => ipcRenderer.invoke("pipeline:apply"),
  verify: () => ipcRenderer.invoke("pipeline:verify"),
});
