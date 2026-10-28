import type { IpcMain, IpcMainInvokeEvent, WebContents } from "electron";
import { DESKTOP_CHANNELS } from "../desktop-api";
import { parseTitleBarGeometry } from "../windows/title-bar-geometry";

interface TitleBarGeometryIpcOptions {
  ipcMain: IpcMain;
  source: WebContents;
  webContents: () => WebContents[];
  assertSender: (event: IpcMainInvokeEvent) => void;
}

export const registerTitleBarGeometryIpc = (options: TitleBarGeometryIpcOptions) => {
  const { ipcMain, source, webContents, assertSender } = options;
  ipcMain.handle(DESKTOP_CHANNELS.requestTitleBarGeometry, (event) => {
    assertSender(event);
    source.send(DESKTOP_CHANNELS.requestTitleBarGeometry);
  });
  ipcMain.handle(DESKTOP_CHANNELS.titleBarGeometry, (event, value: unknown) => {
    assertSender(event);
    // Only the BrowserWindow's document can observe the native overlay. An
    // embedded WebContentsView has its own, empty Window Controls Overlay API.
    if (event.sender.id !== source.id) throw new Error("Title bar geometry must come from the native window");
    const geometry = parseTitleBarGeometry(value);
    for (const contents of webContents()) {
      if (contents.id !== source.id) contents.send(DESKTOP_CHANNELS.titleBarGeometryChanged, geometry);
    }
  });
  return () => {
    ipcMain.removeHandler(DESKTOP_CHANNELS.requestTitleBarGeometry);
    ipcMain.removeHandler(DESKTOP_CHANNELS.titleBarGeometry);
  };
};
