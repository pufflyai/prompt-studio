import { type BrowserWindow, type Rectangle, screen, type WebContents } from "electron";
import { PROJECT_TAB_BOUNDS_CHANNEL } from "./project-tab-input";
import { createProjectTabMouseFilter } from "./project-tab-mouse-filter";

export const filterMacosMouseEvents = (window: BrowserWindow, contents: WebContents) => {
  if (process.platform !== "darwin") return;
  const filter = createProjectTabMouseFilter(() => ({
    cursor: screen.getCursorScreenPoint(),
    windowBounds: window.getBounds(),
    primaryScreenHeight: screen.getPrimaryDisplay().bounds.height,
  }));
  contents.ipc.on(PROJECT_TAB_BOUNDS_CHANNEL, (event, bounds: Rectangle[]) => {
    if (event.senderFrame !== contents.mainFrame) return;
    filter.setTabBounds(bounds);
  });
  window.on("blur", filter.reset);
  window.on("enter-full-screen", filter.reset);
  window.on("leave-full-screen", filter.reset);
  contents.on("did-start-loading", () => filter.setTabBounds([]));
  contents.on("before-input-event", (_event, input) => {
    if (input.key === "Escape") filter.reset();
  });
  contents.once("destroyed", () => {
    window.removeListener("blur", filter.reset);
    window.removeListener("enter-full-screen", filter.reset);
    window.removeListener("leave-full-screen", filter.reset);
  });
  contents.on("before-mouse-event", (event, mouse) => {
    if (!window.isFullScreen()) {
      filter.reset();
      return;
    }
    // AppKit can move a stationary tab press into another coordinate space (ADR 0029).
    if (filter.shouldSuppress(mouse)) event.preventDefault();
  });
};
