export const extensionIframeAllow = (capabilities: readonly string[] = []) =>
  capabilities.some((capability) => capability === "clipboard.write" || capability === "clipboard.write@1")
    ? "fullscreen; clipboard-write"
    : "fullscreen";
