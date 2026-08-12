import { contextBridge, ipcRenderer } from "electron";
import { DESKTOP_CHANNELS, type PromptStudioDesktopApi } from "./desktop-api";

const desktopApi: PromptStudioDesktopApi = Object.freeze({
  cancelQuit: () => ipcRenderer.invoke(DESKTOP_CHANNELS.cancelQuit),
  confirmQuit: () => ipcRenderer.invoke(DESKTOP_CHANNELS.confirmQuit),
  getAppInfo: () => ipcRenderer.invoke(DESKTOP_CHANNELS.appInfo),
  getStartupState: () => ipcRenderer.invoke(DESKTOP_CHANNELS.startupState),
  retryRuntime: () => ipcRenderer.invoke(DESKTOP_CHANNELS.retryRuntime),
  openLogs: () => ipcRenderer.invoke(DESKTOP_CHANNELS.openLogs),
  copyDiagnostics: () => ipcRenderer.invoke(DESKTOP_CHANNELS.copyDiagnostics),
  quitApp: () => ipcRenderer.invoke(DESKTOP_CHANNELS.quitApp),
});

contextBridge.exposeInMainWorld("promptStudioDesktop", desktopApi);
