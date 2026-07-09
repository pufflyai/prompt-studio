import runtimeScript from "pstdio-extensions/bridge/webview-runtime.bundle.js?raw";

export {
  renderExtensionRuntimeHtml,
  renderInlineExtensionRuntimeHtml,
} from "pstdio-extensions/bridge/webview-runtime-html";

// The guest runtime bundle is inlined here so a host app can serve it without
// depending on the private pstdio-extensions package.
export const getExtensionRuntimeScript = () => runtimeScript;
