// The runtime serves every extension webview below this prefix. The next segments
// name the signed capability, then the installed extension and webview it covers.
export const EXTENSION_WEBVIEW_PATH_PREFIX = "/v1/extensions/webviews/";

export const decodeExtensionWebviewSegment = (segment: string) => {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
};

export const parseExtensionWebviewPath = (path: string) => {
  if (!path.startsWith(EXTENSION_WEBVIEW_PATH_PREFIX)) return null;

  const [capability, encodedInstalledExtensionId, encodedWebviewId, resource, ...rest] = path
    .slice(EXTENSION_WEBVIEW_PATH_PREFIX.length)
    .split("/");
  if (!capability || !encodedInstalledExtensionId || !encodedWebviewId || !resource) return null;

  const installedExtensionId = decodeExtensionWebviewSegment(encodedInstalledExtensionId);
  const webviewId = decodeExtensionWebviewSegment(encodedWebviewId);
  if (!installedExtensionId || !webviewId) return null;

  return { capability, resource, rest, scope: { installedExtensionId, webviewId } };
};
