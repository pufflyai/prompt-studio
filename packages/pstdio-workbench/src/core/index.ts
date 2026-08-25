export type {
  WorkbenchBreadcrumbChangeListener,
  WorkbenchBreadcrumbController,
  WorkbenchBreadcrumbItem,
} from "./controllers/breadcrumbs/breadcrumb-registry";
export {
  createResourceBreadcrumbItems,
  createWorkbenchBreadcrumbController,
} from "./controllers/breadcrumbs/breadcrumb-registry";
export type {
  CreateWorkbenchCommandPaletteControllerInput,
  WorkbenchCommandPaletteChangeListener,
  WorkbenchCommandPaletteController,
  WorkbenchCommandPaletteOpenInput,
  WorkbenchCommandPaletteState,
  WorkbenchCommandPaletteView,
} from "./controllers/command-palette/command-palette-controller";
export { createWorkbenchCommandPaletteController } from "./controllers/command-palette/command-palette-controller";
export type {
  WorkbenchCompositionAddablePanel,
  WorkbenchCompositionController,
  WorkbenchCompositionRegionPanels,
} from "./controllers/composition/composition-controller";
export { createWorkbenchCompositionController } from "./controllers/composition/composition-controller";
export type {
  CreateWorkbenchFocusControllerInput,
  WorkbenchFocusChangeListener,
  WorkbenchFocusController,
  WorkbenchFocusRegionId,
  WorkbenchFocusState,
} from "./controllers/focus/focus-controller";
export { createWorkbenchFocusController, workbenchFocusRegions } from "./controllers/focus/focus-controller";
export type {
  CreateHistoryControllerInput,
  HistoryController,
  HistoryEntry,
  HistoryStoreState,
  PersistedWorkbenchHistory,
  WorkbenchHistoryPersistence,
  WorkbenchLocation,
  WorkbenchLocationRef,
  WorkbenchLocationWorkspaceState,
  WorkbenchNavigationEntry,
  WorkbenchPanelMenuRef,
  WorkbenchPanelMenuWorkspaceState,
  WorkbenchPanelWorkspaceState,
  WorkbenchSubPanelRef,
} from "./controllers/history/history-controller";
export { createHistoryController } from "./controllers/history/history-controller";
export type {
  CreateWorkbenchLastResourceControllerInput,
  LastResourcePersistenceAdapter,
  WorkbenchLastResourceController,
} from "./controllers/last-resource/last-resource-controller";
export { createWorkbenchLastResourceController } from "./controllers/last-resource/last-resource-controller";
export {
  createWorkbenchNavigator,
  type WorkbenchNavigationCommit,
  type WorkbenchNavigationDiagnosticCode,
  type WorkbenchNavigationResult,
  type WorkbenchNavigationTarget,
  type WorkbenchNavigator,
  type WorkbenchNavigatorHostHooks,
} from "./controllers/navigator/workbench-navigator";
export type {
  CreateWorkbenchPanelsControllerInput,
  PersistedWorkbenchPanels,
  WorkbenchPanelsChangeListener,
  WorkbenchPanelsController,
  WorkbenchPanelsPersistenceAdapter,
  WorkbenchPanelsState,
} from "./controllers/panels/panels-controller";
export { createWorkbenchPanelsController } from "./controllers/panels/panels-controller";
export type {
  WorkbenchShellController,
  WorkbenchShellOpenRegion,
  WorkbenchShellRegionState,
  WorkbenchSidePanelPresentation,
} from "./controllers/shell/shell-controller";
export type {
  CreateWorkbenchSidePanelControllerInput,
  WorkbenchSidePanelChangeListener,
  WorkbenchSidePanelController,
  WorkbenchSidePanelMode,
  WorkbenchSidePanelPersistenceAdapter,
  WorkbenchSidePanelState,
} from "./controllers/side-panel/side-panel-controller";
export { createWorkbenchSidePanelController } from "./controllers/side-panel/side-panel-controller";
export type {
  WorkbenchTerminalController,
  WorkbenchTerminalSessionAdapter,
  WorkbenchTerminalSessionError,
  WorkbenchTerminalSessionExit,
  WorkbenchTerminalSessionModel,
  WorkbenchTerminalSessionOpener,
  WorkbenchTerminalSessionRequest,
  WorkbenchTerminalSessionSink,
  WorkbenchTerminalSessionStatus,
  WorkbenchTerminalState,
} from "./controllers/terminal/terminal-controller";
export { createWorkbenchTerminalController } from "./controllers/terminal/terminal-controller";
export type {
  CommandPaletteResourceProvider,
  CommandPaletteResourceProviderResult,
  CommandPaletteResourceQueryContext,
  CommandPaletteResourceRegistry,
  CommandPaletteResourceResult,
} from "./registries/command-palette-resources/command-palette-resource-registry";
export { createCommandPaletteResourceRegistry } from "./registries/command-palette-resources/command-palette-resource-registry";
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
} from "./registries/commands/command-registry";
export { createCommandRegistry } from "./registries/commands/command-registry";
export type {
  Keybinding,
  KeybindingRegistry,
  KeybindingSequence,
  RegisteredKeybinding,
} from "./registries/keybindings/keybinding-registry";
export { createKeybindingRegistry, getKeybindingSteps } from "./registries/keybindings/keybinding-registry";
export { resolveComposition } from "./registries/layout/composition-resolver";
export type {
  CompositionDiagnostic,
  CompositionModeDefinition,
  CompositionModeRecipe,
  CompositionPanelDefinition,
  CompositionPanelPlacement,
  CompositionPlacementPolicy,
  CompositionResolutionContext,
  CompositionResourceKindDefinition,
  CompositionResourcePanelEdge,
  CompositionSlotDefinition,
  DockedCompositionRegion,
  PersistedCompositionLayout,
  ResolveCompositionInput,
  ResolvedComposition,
  ResolvedCompositionAddablePanel,
  ResolvedCompositionPlacement,
  WorkbenchComposition,
} from "./registries/layout/composition-resolver-types";
export { dockedCompositionRegions } from "./registries/layout/composition-resolver-types";
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
  WorkbenchFloatingPanelVisibility,
  WorkbenchLayout,
  WorkbenchLayoutStoreState,
  WorkbenchLocationContribution,
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
  WorkbenchSubPanelContribution,
  WorkbenchTabPosition,
  WorkbenchTabRetention,
  WorkbenchWidgetPlacement,
  WorkbenchWidgetRole,
  WorkbenchWidgetTab,
} from "./registries/layout/layout-model";
export {
  createDefaultWorkbenchLayout,
  createLayoutModel,
  getWorkbenchPanelForMenuRegion,
  workbenchPanelMenuRegions,
  workbenchPanelRegions,
  workbenchRegions,
} from "./registries/layout/layout-model";
export {
  allowsWorkbenchFloatingPanels,
  getActiveWorkbenchLocationPanel,
  getActiveWorkbenchSubPanel,
  isWorkbenchPanelPlacementVisible,
  matchesWorkbenchModeEligibility,
  matchesWorkbenchPanelMenuOwner,
} from "./registries/layout/panel-widget-eligibility";
export type { AnchorId, AnchorReadId, SurfaceDescriptor } from "./registries/layout/surface-map";
export {
  getSurface,
  listAnchorRegions,
  listProjectionRegions,
  listProjectionsReading,
  resolveAnchorRegion,
  surfaceMap,
} from "./registries/layout/surface-map";
export type { AnchorReconcileAction, ReconcileAnchorsInput } from "./registries/layout/surface-reconcile";
export { getAnchorResource, reconcileAnchors } from "./registries/layout/surface-reconcile";
export type { MenuItem, MenuPath, MenuRegistry, RegisteredMenuItem } from "./registries/menus/menu-registry";
export { createMenuRegistry } from "./registries/menus/menu-registry";
export {
  headerLeadingMenuPath,
  headerTrailingMenuPath,
  resourceContextMenuPath,
  workbenchCommandPaletteMenuPath,
  workbenchRegionTabAddMenuPath,
  workbenchRegionTabLeadingMenuPath,
  workbenchTopHeaderLeadingMenuPath,
  workbenchTopHeaderTrailingMenuPath,
} from "./registries/menus/workbench-menu-paths";
export type {
  WorkbenchModeActivationContext,
  WorkbenchModeActivationResult,
  WorkbenchModeAddablePanel,
  WorkbenchModeAddablePanelContext,
  WorkbenchModeContribution,
  WorkbenchModeRegistry,
} from "./registries/modes/mode-registry";
export {
  createWorkbenchModeRegistry,
  getWorkbenchModePanelForRegion,
  isWorkbenchModePanelAvailable,
} from "./registries/modes/mode-registry";
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
  NavigationTargetResource,
  NavigationTargetView,
  RegisteredNavigationParser,
  RegisteredResourceNavigator,
  ResourceNavigator,
} from "./registries/navigation/navigation-registry";
export { createNavigationRegistry } from "./registries/navigation/navigation-registry";
export type {
  NotificationRegistry,
  RegisteredWorkbenchNotification,
  WorkbenchNotification,
  WorkbenchNotificationAction,
  WorkbenchNotificationEvent,
  WorkbenchNotificationLevel,
} from "./registries/notifications/notification-registry";
export { createNotificationRegistry } from "./registries/notifications/notification-registry";
export type {
  CreatePreferenceRegistryInput,
  PreferencePersistenceAdapter,
  PreferencePropertySchema,
  PreferenceRegistry,
  PreferenceSchemaContribution,
  PreferenceScope,
  PreferenceScopeRef,
  PreferenceValue,
} from "./registries/preferences/preference-registry";
export { createPreferenceRegistry } from "./registries/preferences/preference-registry";
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
} from "./registries/renderers/controls-renderer-registry";
export { createControlsRendererRegistry } from "./registries/renderers/controls-renderer-registry";
export type {
  DataTableRendererColumn,
  DataTableRendererColumnRenderer,
  DataTableRendererColumnStat,
  DataTableRendererContribution,
  DataTableRendererImplementation,
  DataTableRendererQueryContext,
  DataTableRendererQueryResult,
  DataTableRendererRefreshEvent,
  DataTableRendererRegistry,
  DataTableRendererRow,
  DataTableRendererRowAction,
  DataTableRendererSelectionAction,
  DataTableRendererStoreState,
  DataTableRendererThemeColor,
  RegisteredDataTableRendererContribution,
} from "./registries/renderers/data-table-renderer-registry";
export { createDataTableRendererRegistry } from "./registries/renderers/data-table-renderer-registry";
export type {
  CreateFileRendererRegistryInput,
  FileRendererContent,
  FileRendererContribution,
  FileRendererImplementation,
  FileRendererRefreshEnvelope,
  FileRendererRefreshEvent,
  FileRendererRefreshOrigin,
  FileRendererRegistry,
  FileRendererSaveResult,
  FileRendererStoreState,
  RegisteredFileRendererContribution,
} from "./registries/renderers/file-renderer-registry";
export { createFileRendererRegistry } from "./registries/renderers/file-renderer-registry";
export type {
  AttributeDescriptor,
  AttributeDisplayDescriptor,
  AttributeKind,
  AttributesSource,
  AttributeType,
  BoardColumnAction,
  BoardColumnConfig,
  EnumOption,
  EnumOptions,
  EnumOptionsSource,
  KanbanRendererCreateField,
  KanbanRendererCreateFieldType,
  KanbanRendererCreateRowConfig,
  KanbanRendererCreateSubmission,
  KanbanRendererFilterState,
  KanbanRendererOrdering,
  KanbanRendererRow,
  KanbanRendererSavedView,
  KanbanRendererSettings,
  ResourceContextAction,
  SortDirection,
  ViewMode,
} from "./registries/renderers/kanban-renderer-contracts";
export type {
  CreateKanbanRendererRegistryInput,
  KanbanRendererContribution,
  KanbanRendererImplementation,
  KanbanRendererQueryState,
  KanbanRendererRegistry,
  KanbanRendererStoreState,
  RegisteredKanbanRendererContribution,
} from "./registries/renderers/kanban-renderer-registry";
export { createKanbanRendererRegistry } from "./registries/renderers/kanban-renderer-registry";
export type {
  CreateWorkbenchRendererRegistryInput,
  RegisteredKeepAliveHost,
  WorkbenchPanelRenderInput,
  WorkbenchRendererRegistration,
  WorkbenchRendererRegistry,
  WorkbenchRendererStoreState,
} from "./registries/renderers/renderer-registry";
export { createWorkbenchRendererRegistry } from "./registries/renderers/renderer-registry";
export type {
  CreateTreeRendererRegistryInput,
  PersistedTreeRendererStates,
  RegisteredTreeRendererContribution,
  TreeAction,
  TreeContext,
  TreeNode,
  TreeNodeInlineInput,
  TreeRendererContribution,
  TreeRendererImplementation,
  TreeRendererPersistenceAdapter,
  TreeRendererRefreshEvent,
  TreeRendererRegistry,
  TreeRendererState,
  TreeRendererStoreState,
  TreeViewSection,
} from "./registries/renderers/tree-renderer-registry";
export { createTreeRendererRegistry } from "./registries/renderers/tree-renderer-registry";
export type { StandardResourceIcon } from "./registries/resources/resource-icons";
export { standardResourceIcons } from "./registries/resources/resource-icons";
export type {
  CreateResourceRegistryInput,
  OpenResourceInput,
  RegisteredResourceKind,
  ResolvedResourceHierarchyProvider,
  ResourceBrowseEntry,
  ResourceHierarchyCycle,
  ResourceHierarchyProvider,
  ResourceKindContribution,
  ResourceListContext,
  ResourcePresenter,
  ResourceProvider,
  ResourceRef,
  ResourceRegistry,
  ResourceSurface,
  WorkbenchHierarchyNode,
  WorkbenchViewHierarchyNode,
} from "./registries/resources/resource-registry";
export {
  createResourceRegistry,
  createWorkbenchResourceContextValues,
  createWorkbenchSelectionResourceMetadata,
  getWorkbenchSelectionResourceUris,
  isWorkbenchViewHierarchyNode,
  resourceHierarchyCycleCode,
  workbenchResourceIdContextKey,
  workbenchResourceKindContextKey,
  workbenchResourceMetadataContextKey,
  workbenchSelectionResourceUriMetadataKey,
} from "./registries/resources/resource-registry";
export type {
  CollectionSettingsPanel,
  CustomSettingsPanel,
  RegisteredSettingsPanel,
  RegisteredSettingsSection,
  SchemaSettingsPanel,
  SettingsAction,
  SettingsCollectionGroupBy,
  SettingsPanelBase,
  SettingsPanelContribution,
  SettingsPanelPreference,
  SettingsRegistry,
  SettingsRegistryStoreState,
  SettingsScope,
  SettingsSectionContribution,
} from "./registries/settings/settings-registry";
export { createSettingsRegistry } from "./registries/settings/settings-registry";
export type {
  FileIconThemeFont,
  FileIconThemePreferenceOption,
} from "./registries/themes/file-icon-theme-contracts";
export type {
  FileIconThemeRegistry,
  WorkbenchFileIconThemeStoreState,
} from "./registries/themes/file-icon-theme-registry";
export { createFileIconThemeRegistry } from "./registries/themes/file-icon-theme-registry";
export type {
  ThemePreference,
  ThemePreferenceMode,
  ThemePreferenceOption,
  ThemePreferenceTokens,
} from "./registries/themes/theme-contracts";
export type { ThemeRegistry, WorkbenchThemeStoreState } from "./registries/themes/theme-registry";
export { createThemeRegistry } from "./registries/themes/theme-registry";
export type {
  CreateWorkbenchViewRegistryInput,
  OpenWorkbenchViewInput,
  RegisteredWorkbenchView,
  WorkbenchViewContribution,
  WorkbenchViewOpenEvent,
  WorkbenchViewRegistry,
  WorkbenchViewRegistryStoreState,
} from "./registries/views/view-registry";
export { createViewRegistry, workbenchViewIdContextKey } from "./registries/views/view-registry";
export type { ContextKeyScope, ContextKeyService, ContextKeyValue } from "./shared/context/context-key-service";
export { createContextKeyService, matchesContextExpression } from "./shared/context/context-key-service";
export type {
  ContributionMetadata,
  ContributionSource,
  RegisteredContributionMetadata,
} from "./shared/contributions/metadata";
export type { Disposable } from "./shared/disposable";
export type {
  CreateWorkbenchStoreInput,
  WorkbenchStore,
  WorkbenchStoreListener,
  WorkbenchStoreSelector,
  WorkbenchStoreSelectorListener,
} from "./shared/store/workbench-store";
export { createWorkbenchStore } from "./shared/store/workbench-store";
export {
  getSwitchModeNavigationTargetModeId,
  workbenchSwitchModeCommandId,
} from "./workbench-built-ins";
export type {
  CreateWorkbenchCoreInput,
  WorkbenchCore,
  WorkbenchCoreContributionContext,
  WorkbenchHost,
  WorkbenchLayoutModel,
  WorkbenchModuleContext,
  WorkbenchModuleContribution,
  WorkbenchModuleContributionContext,
  WorkbenchPersistenceAdapter,
  WorkbenchRenderers,
  WorkbenchSnapshot,
} from "./workbench-core";
export { createWorkbenchCore } from "./workbench-core";
