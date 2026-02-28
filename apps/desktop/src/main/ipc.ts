import { ipcMain, dialog, app } from "electron";
import * as path from "node:path";
import {
  initializeArtifacts,
  runScan,
  runPlan,
  runApply,
  runVerify,
  recordApproval,
  assertApproved,
} from "./pipeline-runner.js";

export function registerIpcHandlers() {
  // تهيئة مسار الـ artifacts
  const isDev = !app.isPackaged;
  initializeArtifacts(app.getPath("userData"), isDev);

  // فتح مربع حوار اختيار المجلد
  ipcMain.handle("dialog:openDirectory", async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ["openDirectory"],
    });
    if (canceled) {
      return null;
    } else {
      return filePaths[0];
    }
  });

  // Scan
  ipcMain.handle("pipeline:scan", async (_, repoPath: string) => {
    const result = await runScan(repoPath);
    return result;
  });

  // Plan
  ipcMain.handle("pipeline:plan", async (_, runId: string) => {
    const result = await runPlan(runId);
    return result;
  });

  // Approve (يكتب الموافقة في الخطة ويسجلها)
  ipcMain.handle(
    "pipeline:approve",
    async (_, runId: string, approvedBy: string, notes?: string) => {
      const result = recordApproval(runId, approvedBy, notes);
      return result;
    }
  );

  // Check Approval
  ipcMain.handle("pipeline:checkApproval", async (_, runId: string) => {
    const result = assertApproved(runId);
    return result;
  });

  // Apply (مع التحقق من الموافقة)
  ipcMain.handle("pipeline:apply", async (_, runId: string) => {
    const result = await runApply(runId);
    return result;
  });

  // Verify
  ipcMain.handle("pipeline:verify", async (_, runId: string) => {
    const result = await runVerify(runId);
    return result;
  });
}
