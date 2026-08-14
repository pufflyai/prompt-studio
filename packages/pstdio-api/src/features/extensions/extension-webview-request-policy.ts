import { EXTENSION_RUNTIME_PATH, EXTENSION_RUNTIME_SCRIPT_PATH } from "./extension-runtime-routes";

const READ_ONLY_METHODS = new Set(["GET", "HEAD"]);
const WEBVIEW_ASSET_PATH = /^\/v1\/extensions\/installed\/[^/]+\/webviews\/[^/]+(?:\/.*)?$/;

export const isOpaqueExtensionWebviewAssetRequest = (request: Request) => {
  if (request.headers.get("origin") !== "null" || !READ_ONLY_METHODS.has(request.method)) return false;

  const path = new URL(request.url).pathname;
  return (
    path === `/v1${EXTENSION_RUNTIME_PATH}` ||
    path === `/v1${EXTENSION_RUNTIME_SCRIPT_PATH}` ||
    WEBVIEW_ASSET_PATH.test(path)
  );
};
