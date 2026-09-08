import { contextBridge, ipcRenderer } from "electron";
import { DESKTOP_CHANNELS, type DesktopProjectTabsState, type PromptStudioDesktopApi } from "./desktop-api";
import type { DesktopState } from "./lifecycle/lifecycle-machine";

const desktopApi: PromptStudioDesktopApi = Object.freeze({
  cancelQuit: () => ipcRenderer.invoke(DESKTOP_CHANNELS.cancelQuit),
  confirmQuit: () => ipcRenderer.invoke(DESKTOP_CHANNELS.confirmQuit),
  getAppInfo: () => ipcRenderer.invoke(DESKTOP_CHANNELS.appInfo),
  getStartupState: () => ipcRenderer.invoke(DESKTOP_CHANNELS.startupState),
  onStartupState: (listener: (state: DesktopState) => void) => {
    const receive = (_event: Electron.IpcRendererEvent, state: DesktopState) => listener(state);
    ipcRenderer.on(DESKTOP_CHANNELS.startupStateChanged, receive);
    return () => {
      ipcRenderer.removeListener(DESKTOP_CHANNELS.startupStateChanged, receive);
    };
  },
  retryRuntime: () => ipcRenderer.invoke(DESKTOP_CHANNELS.retryRuntime),
  openLogs: () => ipcRenderer.invoke(DESKTOP_CHANNELS.openLogs),
  revealInFinder: (path: string) => ipcRenderer.invoke(DESKTOP_CHANNELS.revealInFinder, path),
  copyDiagnostics: () => ipcRenderer.invoke(DESKTOP_CHANNELS.copyDiagnostics),
  checkForUpdates: () => ipcRenderer.invoke(DESKTOP_CHANNELS.checkForUpdates),
  quitApp: () => ipcRenderer.invoke(DESKTOP_CHANNELS.quitApp),
  getWorkbenchState: () => ipcRenderer.invoke(DESKTOP_CHANNELS.getWorkbenchState),
  getProjectTabs: () => ipcRenderer.invoke(DESKTOP_CHANNELS.getProjectTabs),
  setProjectTabs: (state: DesktopProjectTabsState) => ipcRenderer.invoke(DESKTOP_CHANNELS.setProjectTabs, state),
  setPageLocation: (projectId: string, value: string | null) =>
    ipcRenderer.invoke(DESKTOP_CHANNELS.setPageLocation, projectId, value),
  setSelectedProjectId: (projectId: string | null) =>
    ipcRenderer.invoke(DESKTOP_CHANNELS.setSelectedProjectId, projectId),
});

contextBridge.exposeInMainWorld("promptStudioDesktop", desktopApi);
