export type { HostCapability, HostCapabilityRegistry, HostEventMessage } from "../contract";
export { availableKeyboardShortcuts, hasLocalKeyboardOwner } from "../guest/keyboard-owner";
export { installKeyboardShortcuts, matchesKeyboardShortcut } from "../guest/keyboard-shortcuts";
export { capabilityReply } from "./capability-reply";
export { ExtensionFrame, type ExtensionFrameProps } from "./extension-frame";
export {
  createWebviewDiagnostics,
  EXTENSION_HOST_LOG_PREFIX,
  type ExtensionHostDiagnostic,
  logExtensionHostDiagnostic,
} from "./host-diagnostics";
export { createHostEventPublisher, type HostEventPublisher } from "./host-event-publisher";
export { extensionIframeAllow } from "./iframe-permissions";
export { collectChakraThemeVariables, postThemeToFrame } from "./theme";
