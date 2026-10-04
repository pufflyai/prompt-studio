import { webviewHostLabel } from "pstdio/runtime";

interface SessionPermissionRequest {
  permission: string;
  requestingUrl: string | undefined;
  isMainFrame: boolean;
  runtimeOrigin: string | null;
}

const WEBVIEW_DOCUMENT_PATH = /^\/v1\/extensions\/webviews\/[^/]+\/[^/]+\/[^/]+\/(runtime|assets\/.+)$/;

export const canGrantSessionPermission = (request: SessionPermissionRequest) => {
  const { permission, requestingUrl, isMainFrame, runtimeOrigin } = request;
  if (permission !== "clipboard-sanitized-write" || !runtimeOrigin || !requestingUrl) {
    return false;
  }

  const url = URL.parse(requestingUrl);
  const runtime = URL.parse(runtimeOrigin);
  if (!url || !runtime) return false;
  if (isMainFrame) return url.origin === runtimeOrigin;
  // Extension webviews run on their own `<extension>.localhost` origin at the runtime port.
  return webviewHostLabel(url.host) !== null && url.port === runtime.port && WEBVIEW_DOCUMENT_PATH.test(url.pathname);
};
