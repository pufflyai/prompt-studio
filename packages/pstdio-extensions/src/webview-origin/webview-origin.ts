import { createHash } from "node:crypto";

// Each installed extension's webviews run on their own origin, `http://<label>.localhost:<port>`.
// The origin isolates one extension from the dashboard and from every other extension, so the
// webview iframe can allow same-origin access to real browser storage. Browsers resolve
// `*.localhost` to loopback without DNS, so these origins work offline.

const WEBVIEW_PATH_PREFIX = "/v1/extensions/webviews";
const LABEL_PATTERN = /^ext-[0-9a-f]{24}$/;

export const webviewOriginLabel = (installedExtensionId: string) =>
  `ext-${createHash("sha256").update(installedExtensionId).digest("hex").slice(0, 24)}`;

/** Returns the extension label when a Host header names a webview origin, otherwise null. */
export const webviewHostLabel = (host: string | undefined) => {
  const hostname = host?.toLowerCase().replace(/:\d+$/, "");
  if (!hostname?.endsWith(".localhost")) return null;
  const label = hostname.slice(0, -".localhost".length);
  return LABEL_PATTERN.test(label) ? label : null;
};

export const isWebviewPath = (path: string) =>
  path === WEBVIEW_PATH_PREFIX || path.startsWith(`${WEBVIEW_PATH_PREFIX}/`);
