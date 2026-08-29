export {
  BRIDGE_WEBVIEW_RENDERER_ID,
  type BridgeWebviewConfig,
  type BridgeWebviewRenderContext,
  type CreateBridgeWebviewHostCapabilities,
  type CreateBridgeWebviewProps,
  type CreateBridgeWebviewTheme,
  createBridgeWebviewRenderer,
  renderBridgeWebviewFrame,
} from "./bridge/bridge-webview-renderer";
export { createTerminalSessionCapability } from "./bridge/terminal-session-capability";
export type {
  ExtensionWebviewArtifactCapabilities,
  ExtensionWebviewFileCapabilities,
} from "./bridge/webview-command-capabilities";
export { createWorkbenchWebviewHostCapabilities } from "./bridge/webview-host-capabilities";
export { registerWorkbenchExtensionCommandPaletteResources } from "./contributions/command-palette-resource-contributions";
export {
  compositionRequiredNotificationId,
  createWorkbenchCompositionRegistry,
  listCompositionAddablePanels,
  reconcileCompositionLayout,
  toPanelPlacements,
  type WorkbenchCompositionRegistry,
} from "./contributions/composition-contributions";
export {
  registerWorkbenchExtensionControlsRenderers,
  type WorkbenchExtensionControlsAdapter,
} from "./contributions/controls-renderer-contributions";
export { registerWorkbenchExtensionDataTableRenderers } from "./contributions/data-table-renderer-contributions";
export {
  buildWorkbenchExtensionCommandPaletteRegistrations,
  buildWorkbenchExtensionMenuRegistrations,
  emptyWorkbenchExtensionMetadata,
  type WorkbenchExtensionCommandPaletteRegistration,
  type WorkbenchExtensionMenuRegistration,
  type WorkbenchExtensionMenuSlotConfig,
  type WorkbenchExtensionMenuWhenBuilder,
  type WorkbenchExtensionMetadata,
} from "./contributions/extension-contributions";
export {
  fileRendererRefreshEnvelopeFromCommand,
  type RegisterWorkbenchExtensionFileRenderersInput,
  registerWorkbenchExtensionFileRenderers,
} from "./contributions/file-renderer-contributions";
export {
  registerWorkbenchExtensionKanbanRenderers,
  type WorkbenchExtensionKanbanRendererAdapter,
} from "./contributions/kanban-renderer-contributions";
export {
  panelMenuDeclarationOffsets,
  type RegisterWorkbenchExtensionPanelInput,
  registerWorkbenchExtensionPanel,
  toWorkbenchCompositionPanelContribution,
} from "./contributions/panel-contributions";
export {
  type RegisterWorkbenchExtensionTreeRenderersInput,
  registerWorkbenchExtensionTreeRenderers,
} from "./contributions/tree-renderer-contributions";
export {
  isExtensionNavigationTarget,
  type ToWorkbenchNavigationTargetInput,
  toWorkbenchNavigationTarget,
  toWorkbenchNavigationTargetResult,
} from "./host/extension-navigation-target";
export type { WorkbenchExtensionCommandContext } from "./host/workbench-extension-command";
export {
  type RegisterWorkbenchExtensionContributionsInput,
  registerWorkbenchExtensionContributions,
} from "./host/workbench-extension-host";
export type { WorkbenchExtensionHostMenuRegistration } from "./host/workbench-extension-host-types";
export { toWorkbenchWhenExpression } from "./host/workbench-extension-metadata-ref";
export {
  type RegisterWorkbenchExtensionRendererRefreshEventsInput,
  refreshOpenWorkbenchExtensionWebviews,
  refreshWorkbenchExtensionRenderer,
  registerWorkbenchExtensionRendererRefreshEvents,
  type WorkbenchExtensionRendererKind,
} from "./host/workbench-extension-refresh";
