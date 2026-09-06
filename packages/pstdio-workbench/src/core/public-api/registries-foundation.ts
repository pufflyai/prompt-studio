export { type DockedWorkbenchRegion, dockedWorkbenchRegions } from "@pstdio/sdk/extensions";
export type {
  CommandPaletteResourceProvider,
  CommandPaletteResourceProviderResult,
  CommandPaletteResourceQueryContext,
  CommandPaletteResourceRegistry,
  CommandPaletteResourceResult,
} from "../registries/command-palette-resources/command-palette-resource-registry";
export { createCommandPaletteResourceRegistry } from "../registries/command-palette-resources/command-palette-resource-registry";
export type {
  Command,
  CommandHandler,
  CommandParamDescriptor,
  CommandParamOption,
  CommandParamSchema,
  CommandRegistry,
  RegisteredCommand,
  WorkbenchCommandExecutionContext,
  WorkbenchCommandExecutionError,
  WorkbenchCommandExecutionErrorListener,
} from "../registries/commands/command-registry";
export { createCommandRegistry } from "../registries/commands/command-registry";
export type {
  Keybinding,
  KeybindingRegistry,
  KeybindingSequence,
  RegisteredKeybinding,
} from "../registries/keybindings/keybinding-registry";
export { createKeybindingRegistry, getKeybindingSteps } from "../registries/keybindings/keybinding-registry";
export type {
  CreateLayoutModelInput,
  LayoutModel,
  LayoutPersistenceAdapter,
  LayoutScope,
  OpenWorkbenchPanelInput,
  PlaceholderContribution,
  RegisteredPlaceholderContribution,
  RegisteredWidgetContribution,
  WidgetContribution,
  WidgetMountStrategy,
  WidgetReusePolicy,
  WorkbenchCommandTarget,
  WorkbenchLayout,
  WorkbenchLayoutStoreState,
  WorkbenchLocationEligibility,
  WorkbenchPanelContribution,
  WorkbenchPanelInstance,
  WorkbenchPanelMenuContribution,
  WorkbenchPanelMenuDefinition,
  WorkbenchPanelMenuOwner,
  WorkbenchPanelMenuRegion,
  WorkbenchPanelMenuSide,
  WorkbenchPanelMountStrategy,
  WorkbenchPanelOpenStrategy,
  WorkbenchPanelRegion,
  WorkbenchPanelReusePolicy,
  WorkbenchPanelTab,
  WorkbenchRegion,
  WorkbenchRegionSize,
  WorkbenchRegionState,
  WorkbenchTabAction,
  WorkbenchTabMenuGroup,
  WorkbenchTabMenuRow,
  WorkbenchTabPosition,
  WorkbenchTabRetention,
  WorkbenchTabSnapshot,
  WorkbenchWidgetPlacement,
  WorkbenchWidgetRole,
  WorkbenchWidgetTab,
} from "../registries/layout/layout-model";
export {
  createDefaultWorkbenchLayout,
  createLayoutModel,
  getWorkbenchPanelForMenuRegion,
  workbenchPanelMenuRegions,
  workbenchPanelRegions,
  workbenchRegions,
} from "../registries/layout/layout-model";
export {
  getActiveWorkbenchLocationPanel,
  getActiveWorkbenchSubPanel,
  isWorkbenchPanelPlacementVisible,
  matchesWorkbenchModeEligibility,
  matchesWorkbenchPanelMenuOwner,
} from "../registries/layout/panel-widget-eligibility";
export type {
  ComposedOwnedPlacements,
  ComposeOwnedPlacementsInput,
  OwnedPlacementReconciliation,
  OwnedPlacementUpdate,
  ReconcileOwnedPlacementsInput,
  ResolvedOwnedPlacement,
} from "../registries/layout/placement-reconciliation";
export {
  composeOwnedPlacements,
  placementIdentityKey,
  reconcileOwnedPlacements,
} from "../registries/layout/placement-reconciliation";
export type { AnchorId, AnchorReadId, SurfaceDescriptor } from "../registries/layout/surface-map";
export {
  getSurface,
  listAnchorRegions,
  listProjectionRegions,
  listProjectionsReading,
  resolveAnchorRegion,
  surfaceMap,
} from "../registries/layout/surface-map";
export type { AnchorReconcileAction, ReconcileAnchorsInput } from "../registries/layout/surface-reconcile";
export { getAnchorResource, reconcileAnchors } from "../registries/layout/surface-reconcile";
export type { MenuItem, MenuPath, MenuRegistry, RegisteredMenuItem } from "../registries/menus/menu-registry";
export { createMenuRegistry } from "../registries/menus/menu-registry";
export {
  headerLeadingMenuPath,
  headerTrailingMenuPath,
  resourceContextMenuPath,
  workbenchCommandPaletteMenuPath,
  workbenchRegionTabAddMenuPath,
  workbenchRegionTabLeadingMenuPath,
  workbenchTopHeaderLeadingMenuPath,
  workbenchTopHeaderTrailingMenuPath,
} from "../registries/menus/workbench-menu-paths";
export type {
  WorkbenchModePlacementContribution,
  WorkbenchModePlacementRegistry,
} from "../registries/modes/mode-placement-registry";
export { createWorkbenchModePlacementRegistry } from "../registries/modes/mode-placement-registry";
export type {
  WorkbenchModeActivationContext,
  WorkbenchModeActivationResult,
  WorkbenchModeAddablePanel,
  WorkbenchModeAddablePanelContext,
  WorkbenchModeContribution,
  WorkbenchModeRegistry,
} from "../registries/modes/mode-registry";
export {
  createWorkbenchModeRegistry,
  getWorkbenchModePanelForRegion,
  isWorkbenchModePanelAvailable,
} from "../registries/modes/mode-registry";
export type {
  CreateNavigationRegistryInput,
  NavigationDispatcherContext,
  NavigationParser,
  NavigationRegistry,
  NavigationTarget,
  NavigationTargetCommand,
  NavigationTargetCompound,
  NavigationTargetItem,
  NavigationTargetPanel,
  RegisteredNavigationParser,
} from "../registries/navigation/navigation-registry";
export { createNavigationRegistry } from "../registries/navigation/navigation-registry";
export type {
  NavigationTreeContext,
  NavigationTreeContribution,
  NavigationTreeOwner,
  NavigationTreeRegistry,
  NavigationTreeSlot,
} from "../registries/navigation/navigation-tree-registry";
export { createNavigationTreeRegistry } from "../registries/navigation/navigation-tree-registry";
export type {
  NotificationRegistry,
  RegisteredWorkbenchNotification,
  WorkbenchNotification,
  WorkbenchNotificationAction,
  WorkbenchNotificationEvent,
  WorkbenchNotificationLevel,
} from "../registries/notifications/notification-registry";
export { createNotificationRegistry } from "../registries/notifications/notification-registry";
export type {
  OpenWorkbenchOverlayInput,
  WorkbenchOverlayContribution,
  WorkbenchOverlayRegistry,
} from "../registries/overlays/overlay-registry";
export { createWorkbenchOverlayRegistry } from "../registries/overlays/overlay-registry";
export type {
  CreateWorkbenchPageRegistryInput,
  WorkbenchPageContribution,
  WorkbenchPageMain,
  WorkbenchPagePlacementInput,
  WorkbenchPageRegistry,
  WorkbenchPageRegistryStoreState,
  WorkbenchPageResourceCodec,
  WorkbenchPageRuntimeState,
  WorkbenchPageSlot,
  WorkbenchPageSlotInstance,
  WorkbenchPageSlotOpenInput,
} from "../registries/pages/page-registry";
export { createWorkbenchPageRegistry } from "../registries/pages/page-registry";
export type {
  WorkbenchPlaceholderContribution,
  WorkbenchPlaceholderRegistry,
} from "../registries/placeholders/placeholder-registry";
export { createWorkbenchPlaceholderRegistry } from "../registries/placeholders/placeholder-registry";
export type {
  WorkbenchOwnedPlacementItem,
  WorkbenchPlacementPresence,
} from "../registries/placements/owned-placement-lifecycle";
export type {
  OpenWorkbenchShellPlacementInput,
  WorkbenchShellPlacementContribution,
  WorkbenchShellPlacementRegistry,
} from "../registries/placements/shell-placement-registry";
export {
  createWorkbenchShellPlacementRegistry,
  shellPlacementContributionId,
} from "../registries/placements/shell-placement-registry";
export type {
  CreatePreferenceRegistryInput,
  PreferencePersistenceAdapter,
  PreferencePropertySchema,
  PreferenceRegistry,
  PreferenceSchemaContribution,
  PreferenceScope,
  PreferenceScopeRef,
  PreferenceValue,
} from "../registries/preferences/preference-registry";
export { createPreferenceRegistry } from "../registries/preferences/preference-registry";
export type {
  ControlsApplyInput,
  ControlsQueryResult,
  ControlsRendererContribution,
  ControlsRendererImplementation,
  ControlsRendererLayout,
  ControlsRendererRefreshEvent,
  ControlsRendererRegistry,
  ControlsRendererStoreState,
  ControlsResetInput,
  ControlsUpdateValueInput,
  CreateControlsRendererRegistryInput,
  RegisteredControlsRendererContribution,
} from "../registries/renderers/controls-renderer-registry";
export { createControlsRendererRegistry } from "../registries/renderers/controls-renderer-registry";
export type { WorkbenchPlacementPresentation } from "../registries/views/view-placement";
