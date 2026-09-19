import { app, BrowserWindow } from "electron";
import { secureWebContents } from "../security/apply-window-security";
import { createSecureWindowOptions } from "../security/window-security";

void app.whenReady().then(async () => {
  const window = new BrowserWindow(createSecureWindowOptions("", "external-links"));
  secureWebContents(window.webContents, {
    lifecycleUrl: "pstdio://lifecycle/index.html",
    runtimeOrigin: () => null,
    openExternal: async (url) => {
      console.log(`opened-external:${url}`);
    },
  });
  await window.loadURL("data:text/html,<main>Chat links</main>");
  window.show();
});
