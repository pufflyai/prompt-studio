import { contextBridge, ipcRenderer } from "electron";
import { DESKTOP_CHANNELS, type PromptStudioDesktopApi } from "./desktop-api";

const desktopApi: PromptStudioDesktopApi = Object.freeze({
  cancelQuit: () => ipcRenderer.invoke(DESKTOP_CHANNELS.cancelQuit),
  confirmQuit: () => ipcRenderer.invoke(DESKTOP_CHANNELS.confirmQuit),
  getAppInfo: () => ipcRenderer.invoke(DESKTOP_CHANNELS.appInfo),
  getStartupState: () => ipcRenderer.invoke(DESKTOP_CHANNELS.startupState),
  retryRuntime: () => ipcRenderer.invoke(DESKTOP_CHANNELS.retryRuntime),
  openLogs: () => ipcRenderer.invoke(DESKTOP_CHANNELS.openLogs),
  revealInFinder: (path: string) => ipcRenderer.invoke(DESKTOP_CHANNELS.revealInFinder, path),
  copyDiagnostics: () => ipcRenderer.invoke(DESKTOP_CHANNELS.copyDiagnostics),
  checkForUpdates: () => ipcRenderer.invoke(DESKTOP_CHANNELS.checkForUpdates),
  quitApp: () => ipcRenderer.invoke(DESKTOP_CHANNELS.quitApp),
  getWorkbenchState: () => ipcRenderer.invoke(DESKTOP_CHANNELS.getWorkbenchState),
  setLastResource: (projectId: string, value: string | null) =>
    ipcRenderer.invoke(DESKTOP_CHANNELS.setLastResource, projectId, value),
  setSelectedProjectId: (projectId: string | null) =>
    ipcRenderer.invoke(DESKTOP_CHANNELS.setSelectedProjectId, projectId),
});

contextBridge.exposeInMainWorld("promptStudioDesktop", desktopApi);
