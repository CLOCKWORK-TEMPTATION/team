const { contextBridge, ipcRenderer } = require("electron");

/**
 * API متاح في Renderer Process
 * يتم استدعاؤه عبر window.repoRefactor
 */
const api = {
  // اختيار المجلد
  selectRepo: () => ipcRenderer.invoke("dialog:openDirectory"),

  // خطوات Pipeline
  scan: (repoPath: string) => ipcRenderer.invoke("pipeline:scan", repoPath),
  plan: (runId: string) => ipcRenderer.invoke("pipeline:plan", runId),
  getPlanReport: (runId: string) => ipcRenderer.invoke("pipeline:getPlanReport", runId),
  apply: (runId: string) => ipcRenderer.invoke("pipeline:apply", runId),
  verify: (runId: string) => ipcRenderer.invoke("pipeline:verify", runId),

  // الموافقة
  approve: (runId: string, approvedBy: string, notes?: string) =>
    ipcRenderer.invoke("pipeline:approve", runId, approvedBy, notes),
  checkApproval: (runId: string) =>
    ipcRenderer.invoke("pipeline:checkApproval", runId),
};

// تصدير API للـ Renderer
contextBridge.exposeInMainWorld("repoRefactor", api);

// للتأكد من التحميل
console.log("[preload] Repo Refactor API loaded successfully");
