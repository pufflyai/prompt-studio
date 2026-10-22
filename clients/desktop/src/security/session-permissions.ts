import { LIFECYCLE_URL } from "../windows/lifecycle-protocol";

interface SessionPermissionRequest {
  permission: string;
  requestingUrl: string | undefined;
  isMainFrame: boolean;
  runtimeOrigin: string | null;
}

export const canGrantSessionPermission = (request: SessionPermissionRequest) => {
  const { permission, requestingUrl, isMainFrame, runtimeOrigin } = request;
  if (permission !== "clipboard-sanitized-write" || !requestingUrl) {
    return false;
  }

  const url = URL.parse(requestingUrl);
  if (!url) return false;
  url.search = "";
  url.hash = "";
  if (isMainFrame && url.href === LIFECYCLE_URL) return true;
  if (!runtimeOrigin || url.origin !== runtimeOrigin) return false;
  return isMainFrame || /^\/v1\/extensions\/webviews\/[^/]+\/[^/]+\/[^/]+\/(runtime|assets\/.+)$/.test(url.pathname);
};
