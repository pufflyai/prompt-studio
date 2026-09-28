interface SessionPermissionRequest {
  permission: string;
  requestingUrl: string | undefined;
  isMainFrame: boolean;
  runtimeOrigin: string | null;
}

export const canGrantSessionPermission = (request: SessionPermissionRequest) => {
  const { permission, requestingUrl, isMainFrame, runtimeOrigin } = request;
  if (permission !== "clipboard-sanitized-write" || !runtimeOrigin || !requestingUrl) {
    return false;
  }

  const url = URL.parse(requestingUrl);
  if (url?.origin !== runtimeOrigin) return false;
  return isMainFrame || /^\/v1\/extensions\/webviews\/[^/]+\/[^/]+\/[^/]+\/(runtime|assets\/.+)$/.test(url.pathname);
};
