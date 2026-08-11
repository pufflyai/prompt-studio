import type { BrowserWindow, Session, WebContents } from "electron";
import { CONTENT_SECURITY_POLICY, decideNavigation } from "./window-security";

type WindowSecurityOptions = {
  lifecycleUrl: string;
  runtimeOrigin: () => string | null;
  openExternal: (url: string) => Promise<void>;
};

export const secureSession = (session: Session) => {
  session.setPermissionCheckHandler(() => false);
  session.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  session.webRequest.onHeadersReceived((details, callback) => {
    if (details.resourceType !== "mainFrame") {
      callback({ responseHeaders: details.responseHeaders });
      return;
    }
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [CONTENT_SECURITY_POLICY],
      },
    });
  });
};

export const secureWebContents = (webContents: WebContents, options: WindowSecurityOptions) => {
  const decide = (url: string) =>
    decideNavigation(url, { lifecycleUrl: options.lifecycleUrl, runtimeOrigin: options.runtimeOrigin() });

  webContents.on("will-navigate", (event, url) => {
    const decision = decide(url);
    if (decision === "allow") return;
    event.preventDefault();
    if (decision === "external") void options.openExternal(url);
  });
  webContents.on("will-attach-webview", (event) => event.preventDefault());
  webContents.setWindowOpenHandler(({ url }) => {
    if (decide(url) === "external") void options.openExternal(url);
    return { action: "deny" };
  });
};

export const focusPrimaryWindow = (window: BrowserWindow | null) => {
  if (!window || window.isDestroyed()) return;
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
};
