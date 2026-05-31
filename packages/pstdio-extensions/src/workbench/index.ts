export {
  BRIDGE_WEBVIEW_RENDERER_ID,
  type BridgeWebviewConfig,
  type BridgeWebviewRenderContext,
  type CreateBridgeWebviewHostCapabilities,
  type CreateBridgeWebviewProps,
  createBridgeWebviewRenderer,
} from "./bridge-webview-renderer";
export {
  buildWorkbenchExtensionMenuRegistrations,
  buildWorkbenchExtensionRouteEntries,
  emptyWorkbenchExtensionMetadata,
  type WorkbenchExtensionMenuRegistration,
  type WorkbenchExtensionMenuSlotConfig,
  type WorkbenchExtensionMenuWhenBuilder,
  type WorkbenchExtensionMetadata,
  type WorkbenchExtensionRoute,
  type WorkbenchExtensionRouteResourceInput,
} from "./extension-contributions";
export { createWorkbenchWebviewHostCapabilities } from "./webview-host-capabilities";
