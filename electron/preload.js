"use strict";

const { contextBridge, ipcRenderer } = require("electron");

// Expose a safe, explicit API to renderer — no raw ipcRenderer access
contextBridge.exposeInMainWorld("electronAPI", {
  /** Returns the OS platform: 'win32' | 'darwin' | 'linux' */
  getPlatform: () => ipcRenderer.invoke("get-platform"),

  /** Returns the Electron app version */
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),

  /** Show a native OS notification */
  showNotification: (title, body) =>
    ipcRenderer.invoke("show-notification", { title, body }),

  /** Listen for auto-update events broadcast from main */
  onUpdateAvailable: (cb) => {
    const handler = (_, info) => cb(info);
    ipcRenderer.on("update-available", handler);
    return () => ipcRenderer.removeListener("update-available", handler);
  },
  onUpdateDownloaded: (cb) => {
    const handler = (_, info) => cb(info);
    ipcRenderer.on("update-downloaded", handler);
    return () => ipcRenderer.removeListener("update-downloaded", handler);
  },
  onUpdateProgress: (cb) => {
    const handler = (_, progress) => cb(progress);
    ipcRenderer.on("update-progress", handler);
    return () => ipcRenderer.removeListener("update-progress", handler);
  },

  /** Trigger a manual update check */
  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),

  /** Trigger install-and-restart from renderer */
  installUpdate: () => ipcRenderer.invoke("install-update"),
});
