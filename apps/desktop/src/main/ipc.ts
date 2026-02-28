import { ipcMain, dialog } from "electron";
import { execa } from "execa";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cliPath = path.resolve(__dirname, "../../../../packages/engine/dist/cli/index.js");

export function registerIpcHandlers() {
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

  ipcMain.handle("pipeline:scan", async (_, repoPath: string) => {
    try {
      const { stdout } = await execa("node", [cliPath, "scan", repoPath]);
      return { success: true, output: stdout };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("pipeline:plan", async (_, runId: string) => {
    try {
      const { stdout } = await execa("node", [cliPath, "plan", runId]);
      return { success: true, output: stdout };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
}
