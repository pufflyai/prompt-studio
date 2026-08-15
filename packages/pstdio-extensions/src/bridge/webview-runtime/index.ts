import runtimeScript from "./runtime.bundle.js" with { type: "text" };

export { renderExtensionRuntimeHtml, renderInlineExtensionRuntimeHtml } from "./runtime-html";

export const getExtensionRuntimeScript = () => runtimeScript;
