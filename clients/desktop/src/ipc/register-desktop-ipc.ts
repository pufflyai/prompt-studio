import type { BrowserWindow, IpcMain, IpcMainInvokeEvent } from "electron";
import { DESKTOP_CHANNELS } from "../desktop-api";
import type { DesktopState } from "../lifecycle/lifecycle-machine";
import { isAllowedIpcSender } from "../security/ipc-security";

type DesktopIpcOptions = {
  appInfo: () => { platform: string; version: string };
  copyDiagnostics: () => void;
  getState: () => DesktopState;
  ipcMain: IpcMain;
  lifecycleUrl: string;
  openLogs: () => void;
  quitApp: () => Promise<void>;
  retryRuntime: () => Promise<void>;
  runtimeOrigin: () => string | null;
  window: BrowserWindow;
};

const assertSender = (event: IpcMainInvokeEvent, options: DesktopIpcOptions) => {
  const senderFrame = event.senderFrame;
  const allowed = isAllowedIpcSender(
    {
      senderId: event.sender.id,
      senderFrameUrl: senderFrame?.url ?? "",
      isMainFrame: senderFrame === event.sender.mainFrame,
    },
    {
      expectedWebContentsId: options.window.webContents.id,
      lifecycleUrl: options.lifecycleUrl,
      runtimeOrigin: options.runtimeOrigin(),
    },
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

  handle(DESKTOP_CHANNELS.appInfo, options.appInfo);
  handle(DESKTOP_CHANNELS.startupState, options.getState);
  handle(DESKTOP_CHANNELS.retryRuntime, options.retryRuntime);
  handle(DESKTOP_CHANNELS.openLogs, options.openLogs);
  handle(DESKTOP_CHANNELS.copyDiagnostics, options.copyDiagnostics);
  handle(DESKTOP_CHANNELS.quitApp, options.quitApp);

  return () => {
    for (const channel of Object.values(DESKTOP_CHANNELS)) options.ipcMain.removeHandler(channel);
  };
};
