interface SessionPermissionRequest {
  permission: string;
  requestingUrl: string | undefined;
  isMainFrame: boolean;
  runtimeOrigin: string | null;
}

export const canGrantSessionPermission = (request: SessionPermissionRequest) => {
  const { permission, requestingUrl, isMainFrame, runtimeOrigin } = request;
  if (permission !== "clipboard-sanitized-write" || !isMainFrame || !runtimeOrigin || !requestingUrl) {
    return false;
  }

  return URL.parse(requestingUrl)?.origin === runtimeOrigin;
};
