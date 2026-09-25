export type { HostCapability, HostCapabilityRegistry, HostEventMessage } from "../contract";
export { ExtensionFrame, type ExtensionFrameProps } from "./extension-frame";
export {
  createWebviewDiagnostics,
  EXTENSION_HOST_LOG_PREFIX,
  type ExtensionHostDiagnostic,
  logExtensionHostDiagnostic,
} from "./host-diagnostics";
export { createHostEventPublisher, type HostEventPublisher } from "./host-event-publisher";
export { collectChakraThemeVariables, postThemeToFrame } from "./theme";
