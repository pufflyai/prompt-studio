import { contextBridge, ipcRenderer, webFrame } from "electron";
import type { UpdateChannel } from "pstdio-paths";
import {
  DESKTOP_CHANNELS,
  type DesktopProjectTabsState,
  type DesktopStartupAppearance,
  type PromptStudioDesktopApi,
} from "./desktop-api";
import type { DesktopState } from "./lifecycle/lifecycle-machine";
import { installTitleBarGeometry } from "./windows/install-title-bar-geometry";
import { observeTitleBarAppearance } from "./windows/observe-title-bar-appearance";

// Bundle failures happen before the dashboard can install its own error reporting.
if (window.location.protocol === "http:" || window.location.protocol === "https:") {
  let reportedStartupFailure = false;
  window.addEventListener(
    "error",
    (event) => {
      if (reportedStartupFailure || document.getElementById("root")?.hasChildNodes()) return;
      const scriptFailed = event.target instanceof HTMLScriptElement;
      if (!scriptFailed && !(event instanceof ErrorEvent)) return;
      reportedStartupFailure = true;
      void ipcRenderer.invoke(DESKTOP_CHANNELS.reportWorkbenchError, {
        message: scriptFailed ? "The workbench app files could not load." : event.message,
      });
    },
    true,
  );
}

if (process.platform === "darwin") {
  const applyFullScreen = (fullScreen: boolean) => {
    document.documentElement.toggleAttribute("data-window-full-screen", fullScreen);
  };
  ipcRenderer.on(DESKTOP_CHANNELS.fullScreenChanged, (_event, fullScreen: boolean) => applyFullScreen(fullScreen));
  window.addEventListener(
    "DOMContentLoaded",
    () => {
      void ipcRenderer.invoke(DESKTOP_CHANNELS.isFullScreen).then(applyFullScreen);
    },
    { once: true },
  );
}

if (process.platform !== "darwin") {
  window.addEventListener(
    "DOMContentLoaded",
    () => {
      const stopGeometry = installTitleBarGeometry();
      const stop = observeTitleBarAppearance((appearance) => {
        void ipcRenderer.invoke(DESKTOP_CHANNELS.titleBarAppearance, {
          ...appearance,
          height: Math.round(appearance.height * webFrame.getZoomFactor()),
        });
      });
      window.addEventListener(
        "unload",
        () => {
          stop();
          stopGeometry();
        },
        { once: true },
      );
    },
    { once: true },
  );
}

const desktopApi: PromptStudioDesktopApi = Object.freeze({
  saveFile: (input: Parameters<PromptStudioDesktopApi["saveFile"]>[0]) =>
    ipcRenderer.invoke(DESKTOP_CHANNELS.saveFile, input),
  cancelQuit: () => ipcRenderer.invoke(DESKTOP_CHANNELS.cancelQuit),
  confirmQuit: () => ipcRenderer.invoke(DESKTOP_CHANNELS.confirmQuit),
  getAppInfo: () => ipcRenderer.invoke(DESKTOP_CHANNELS.appInfo),
  getStartupAppearance: () => ipcRenderer.invoke(DESKTOP_CHANNELS.getStartupAppearance),
  onStartupAppearance: (listener: (appearance: DesktopStartupAppearance) => void) => {
    const receive = (_event: Electron.IpcRendererEvent, appearance: DesktopStartupAppearance) => listener(appearance);
    ipcRenderer.on(DESKTOP_CHANNELS.startupAppearanceChanged, receive);
    return () => {
      ipcRenderer.removeListener(DESKTOP_CHANNELS.startupAppearanceChanged, receive);
    };
  },
  setStartupAppearance: (appearance: DesktopStartupAppearance) =>
    ipcRenderer.invoke(DESKTOP_CHANNELS.setStartupAppearance, appearance),
  getStartupState: () => ipcRenderer.invoke(DESKTOP_CHANNELS.startupState),
  onStartupState: (listener: (state: DesktopState) => void) => {
    const receive = (_event: Electron.IpcRendererEvent, state: DesktopState) => listener(state);
    ipcRenderer.on(DESKTOP_CHANNELS.startupStateChanged, receive);
    return () => {
      ipcRenderer.removeListener(DESKTOP_CHANNELS.startupStateChanged, receive);
    };
  },
  onCommand: (listener: (commandId: string) => void) => {
    const receive = (_event: Electron.IpcRendererEvent, commandId: string) => listener(commandId);
    ipcRenderer.on(DESKTOP_CHANNELS.command, receive);
    return () => {
      ipcRenderer.removeListener(DESKTOP_CHANNELS.command, receive);
    };
  },
  retryRuntime: () => ipcRenderer.invoke(DESKTOP_CHANNELS.retryRuntime),
  openLogs: () => ipcRenderer.invoke(DESKTOP_CHANNELS.openLogs),
  revealInFinder: (path: string) => ipcRenderer.invoke(DESKTOP_CHANNELS.revealInFinder, path),
  copyDiagnostics: () => ipcRenderer.invoke(DESKTOP_CHANNELS.copyDiagnostics),
  checkForUpdates: () => ipcRenderer.invoke(DESKTOP_CHANNELS.checkForUpdates),
  restartToInstallUpdate: () => ipcRenderer.invoke(DESKTOP_CHANNELS.restartToInstallUpdate),
  takeUpdateNotice: () => ipcRenderer.invoke(DESKTOP_CHANNELS.takeUpdateNotice),
  onUpdateNotice: (listener: () => void) => {
    const receive = () => listener();
    ipcRenderer.on(DESKTOP_CHANNELS.updateNotice, receive);
    return () => {
      ipcRenderer.removeListener(DESKTOP_CHANNELS.updateNotice, receive);
    };
  },
  getUpdateChannel: () => ipcRenderer.invoke(DESKTOP_CHANNELS.getUpdateChannel),
  setUpdateChannel: (channel: UpdateChannel) => ipcRenderer.invoke(DESKTOP_CHANNELS.setUpdateChannel, channel),
  quitApp: () => ipcRenderer.invoke(DESKTOP_CHANNELS.quitApp),
  getWorkbenchState: () => ipcRenderer.invoke(DESKTOP_CHANNELS.getWorkbenchState),
  getProjectTabs: () => ipcRenderer.invoke(DESKTOP_CHANNELS.getProjectTabs),
  setProjectTabs: (state: DesktopProjectTabsState) => ipcRenderer.invoke(DESKTOP_CHANNELS.setProjectTabs, state),
  setWorkbenchItem: (key: string, value: string | null) =>
    ipcRenderer.invoke(DESKTOP_CHANNELS.setWorkbenchItem, key, value),
  reportWorkbenchError: (report: unknown) => ipcRenderer.invoke(DESKTOP_CHANNELS.reportWorkbenchError, report),
  getPerformanceMonitoring: () => ipcRenderer.invoke(DESKTOP_CHANNELS.getPerformanceMonitoring),
  setPerformanceMonitoring: (enabled: boolean) =>
    ipcRenderer.invoke(DESKTOP_CHANNELS.setPerformanceMonitoring, enabled),
  retainPerformanceCapture: (id: string, monitoring?: boolean) =>
    ipcRenderer.invoke(DESKTOP_CHANNELS.retainPerformanceCapture, id, monitoring),
  releasePerformanceCapture: (id: string) => ipcRenderer.invoke(DESKTOP_CHANNELS.releasePerformanceCapture, id),
  getPerformanceSnapshot: () => ipcRenderer.invoke(DESKTOP_CHANNELS.getPerformanceSnapshot),
  getPerformanceRecordings: () => ipcRenderer.invoke(DESKTOP_CHANNELS.getPerformanceRecordings),
  reportSlowFrames: (report: unknown) => ipcRenderer.invoke(DESKTOP_CHANNELS.reportSlowFrames, report),
  reportRendererState: (report: unknown) => ipcRenderer.invoke(DESKTOP_CHANNELS.reportRendererState, report),
});

contextBridge.exposeInMainWorld("promptStudioDesktop", desktopApi);
