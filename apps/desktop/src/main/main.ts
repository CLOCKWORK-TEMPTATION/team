import { app, BrowserWindow, ipcMain } from "electron";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { registerIpcHandlers } from "./ipc.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  if (process.env.NODE_ENV === "development") {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../../renderer/index.html"));
  }
}

app.whenReady().then(() => {
  registerIpcHandlers();
  
  // Health check endpoint
  ipcMain.handle("health-check", () => {
    return { status: "ok", uptime: process.uptime(), timestamp: Date.now() };
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  console.log("App is shutting down gracefully...");
});

const handleShutdown = () => {
  console.log("Received shutdown signal. Initiating graceful shutdown...");
  BrowserWindow.getAllWindows().forEach((win) => win.close());
  app.quit();
};

process.on("SIGINT", handleShutdown);
process.on("SIGTERM", handleShutdown);

