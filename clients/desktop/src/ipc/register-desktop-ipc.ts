import { isAbsolute } from "node:path";
import type { IpcMain, IpcMainInvokeEvent, WebContents } from "electron";
import type { DesktopProjectTabsState, DesktopStartupAppearance, DesktopWorkbenchState } from "../desktop-api";
import { DESKTOP_CHANNELS } from "../desktop-api";
import type { DesktopState } from "../lifecycle/lifecycle-machine";
import { isAllowedIpcSender } from "../security/ipc-security";
import { type TitleBarAppearance, titleBarOverlayOptions } from "../windows/title-bar-appearance";

type DesktopIpcOptions = {
  isFullScreen: () => boolean;
  setTitleBarAppearance: (appearance: TitleBarAppearance) => Promise<void>;
  appInfo: () => { platform: string; version: string };
  cancelQuit: () => Promise<void>;
  checkForUpdates: () => Promise<void>;
  confirmQuit: () => Promise<void>;
  copyDiagnostics: () => void;
  getState: () => DesktopState;
  getStartupAppearance: () => DesktopStartupAppearance | undefined;
  setStartupAppearance: (appearance: unknown) => void;
  getWorkbenchState: () => DesktopWorkbenchState;
  getProjectTabs: () => Promise<DesktopProjectTabsState>;
  setProjectTabs: (state: unknown) => Promise<void>;
  ipcMain: IpcMain;
  lifecycleUrl: string;
  openLogs: () => void;
  revealInFinder: (path: string) => void;
  quitApp: () => Promise<void>;
  retryRuntime: () => Promise<void>;
  runtimeOrigin: () => string | null;
  setWorkbenchItem: (key: string, value: string | null) => void;
  webContents: () => WebContents[];
  performance: {
    readonly enabled: boolean;
    setEnabled: (enabled: boolean) => Promise<void>;
    snapshot: () => unknown;
    reportFrames: (report: unknown) => void;
    reportRendererState: (report: unknown) => void;
  };
};

const assertSender = (event: IpcMainInvokeEvent, options: DesktopIpcOptions) => {
  const senderFrame = event.senderFrame;
  const allowed = options.webContents().some((webContents) =>
    isAllowedIpcSender(
      {
        senderId: event.sender.id,
        senderFrameUrl: senderFrame?.url ?? "",
        isMainFrame: senderFrame === event.sender.mainFrame,
      },
      {
        expectedWebContentsId: webContents.id,
        lifecycleUrl: options.lifecycleUrl,
        runtimeOrigin: options.runtimeOrigin(),
      },
    ),
  );
  if (!allowed) throw new Error("Rejected desktop IPC from an untrusted sender");
};

export const registerDesktopIpc = (options: DesktopIpcOptions) => {
  const handle = (channel: string, action: (...args: unknown[]) => unknown | Promise<unknown>) => {
    options.ipcMain.handle(channel, (event, ...args) => {
      assertSender(event, options);
      return action(...args);
    });
  };

  handle(DESKTOP_CHANNELS.cancelQuit, options.cancelQuit);
  handle(DESKTOP_CHANNELS.isFullScreen, options.isFullScreen);
  handle(DESKTOP_CHANNELS.titleBarAppearance, (appearance) =>
    options.setTitleBarAppearance(titleBarOverlayOptions(appearance)),
  );
  handle(DESKTOP_CHANNELS.confirmQuit, options.confirmQuit);
  handle(DESKTOP_CHANNELS.appInfo, options.appInfo);
  handle(DESKTOP_CHANNELS.startupState, options.getState);
  handle(DESKTOP_CHANNELS.getStartupAppearance, () => options.getStartupAppearance() ?? null);
  handle(DESKTOP_CHANNELS.setStartupAppearance, options.setStartupAppearance);
  handle(DESKTOP_CHANNELS.retryRuntime, options.retryRuntime);
  handle(DESKTOP_CHANNELS.openLogs, options.openLogs);
  handle(DESKTOP_CHANNELS.revealInFinder, (path) => {
    if (typeof path !== "string" || !isAbsolute(path)) throw new Error("A valid absolute path is required.");
    options.revealInFinder(path);
  });
  handle(DESKTOP_CHANNELS.copyDiagnostics, options.copyDiagnostics);
  handle(DESKTOP_CHANNELS.checkForUpdates, options.checkForUpdates);
  handle(DESKTOP_CHANNELS.quitApp, options.quitApp);
  handle(DESKTOP_CHANNELS.getWorkbenchState, options.getWorkbenchState);
  handle(DESKTOP_CHANNELS.getProjectTabs, options.getProjectTabs);
  handle(DESKTOP_CHANNELS.setProjectTabs, options.setProjectTabs);
  handle(DESKTOP_CHANNELS.setWorkbenchItem, (key, value) => {
    if (typeof key !== "string" || !key || (typeof value !== "string" && value !== null)) {
      throw new Error("Invalid desktop workbench update");
    }
    options.setWorkbenchItem(key, value);
  });
  handle(DESKTOP_CHANNELS.getPerformanceMonitoring, () => options.performance.enabled);
  handle(DESKTOP_CHANNELS.setPerformanceMonitoring, (enabled) => {
    if (typeof enabled !== "boolean") throw new Error("Invalid performance monitoring update");
    return options.performance.setEnabled(enabled);
  });
  handle(DESKTOP_CHANNELS.getPerformanceSnapshot, () => options.performance.snapshot());
  handle(DESKTOP_CHANNELS.reportSlowFrames, (report) => options.performance.reportFrames(report));
  handle(DESKTOP_CHANNELS.reportRendererState, (report) => options.performance.reportRendererState(report));

  return () => {
    for (const channel of Object.values(DESKTOP_CHANNELS)) options.ipcMain.removeHandler(channel);
  };
};
