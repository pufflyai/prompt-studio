import runtimeScript from "./runtime.bundle.js" with { type: "text" };

export { renderExtensionRuntimeHtml } from "./runtime-html";

export const getExtensionRuntimeScript = () => runtimeScript;
