"use strict";

const { autoUpdater } = require("electron-updater");
const { ipcMain } = require("electron");
const isDev = require("electron-is-dev");

function initAutoUpdater(mainWindow) {
  if (isDev) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  // Forward all events to renderer through mainWindow
  autoUpdater.on("update-available", (info) => {
    mainWindow?.webContents.send("update-available", info);
  });

  autoUpdater.on("update-not-available", () => {
    // Silently ignore — no need to notify the user
  });

  autoUpdater.on("download-progress", (progress) => {
    mainWindow?.webContents.send("update-progress", {
      percent: Math.round(progress.percent),
      transferred: progress.transferred,
      total: progress.total,
      bytesPerSecond: progress.bytesPerSecond,
    });
  });

  autoUpdater.on("update-downloaded", (info) => {
    mainWindow?.webContents.send("update-downloaded", info);
  });

  autoUpdater.on("error", (err) => {
    console.error("[AutoUpdater]", err.message);
  });

  // Renderer can trigger install-and-restart
  ipcMain.handle("install-update", () => {
    autoUpdater.quitAndInstall(false, true);
  });

  ipcMain.handle("check-for-updates", async () => {
    const result = await autoUpdater.checkForUpdates();
    return {
      version: result?.updateInfo?.version ?? null,
    };
  });

  // Check on startup, then every 4 hours
  autoUpdater.checkForUpdates();
  setInterval(() => autoUpdater.checkForUpdates(), 4 * 60 * 60 * 1000);
}

module.exports = { initAutoUpdater };
