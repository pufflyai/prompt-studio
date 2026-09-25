import { join } from "node:path";
import { app, BrowserWindow, ipcMain } from "electron";
import { registerDesktopIpc } from "../ipc/register-desktop-ipc";
import { DesktopWorkbenchStateStore } from "../windows/workbench-state-store";

void app.whenReady().then(async () => {
  const url = new URL(process.env.PSTDIO_TICKET_VIEW_URL!);
  const store = new DesktopWorkbenchStateStore(join(app.getPath("userData"), "workbench-state.json"));
  store.setSelectedProjectId(url.pathname.split("/")[2]!);
  const window = new BrowserWindow({
    webPreferences: {
      partition: "pstdio-workbench",
      preload: join(import.meta.dirname, "preload.cjs"),
      contextIsolation: true,
      sandbox: true,
    },
  });
  const noop = async () => {};
  registerDesktopIpc({
    ipcMain,
    lifecycleUrl: "pstdio-lifecycle://app/",
    runtimeOrigin: () => url.origin,
    webContents: () => [window.webContents],
    getWorkbenchState: () => store.getState(),
    setKanbanView: (key, value) => store.setKanbanView(key, value),
    setPageLocation: (key, value) => store.setPageLocation(key, value),
    setSelectedProjectId: (value) => store.setSelectedProjectId(value),
    isFullScreen: () => false,
    getProjectTabs: async () => ({ projectIds: [] }),
    setProjectTabs: noop,
    appInfo: () => ({ platform: process.platform, version: "test" }),
    getState: () => ({ kind: "starting", phase: "discovery" }),
    cancelQuit: noop,
    checkForUpdates: noop,
    confirmQuit: noop,
    copyDiagnostics: noop,
    openLogs: noop,
    revealInFinder: noop,
    quitApp: noop,
    retryRuntime: noop,
    setTitleBarAppearance: noop,
  });
  await window.loadURL(url.href);
});
