import { type BrowserWindow, screen, type WebContents } from "electron";
import { isMisplacedMacosMouseMove } from "./misplaced-macos-mouse-event";

export const filterMacosMouseEvents = (window: BrowserWindow, contents: WebContents) => {
  if (process.platform !== "darwin") return;
  contents.on("before-mouse-event", (event, mouse) => {
    // AppKit can send a stationary move in the wrong coordinate space (ADR 0029).
    const misplaced =
      window.isFullScreen() &&
      isMisplacedMacosMouseMove(mouse, () => ({
        cursor: screen.getCursorScreenPoint(),
        windowBounds: window.getBounds(),
        primaryScreenHeight: screen.getPrimaryDisplay().bounds.height,
      }));
    if (misplaced) {
      event.preventDefault();
    }
  });
};
