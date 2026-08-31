export type {
  WorkbenchBreadcrumbChangeListener,
  WorkbenchBreadcrumbController,
  WorkbenchBreadcrumbItem,
} from "../controllers/breadcrumbs/breadcrumb-registry";
export {
  createResourceBreadcrumbItems,
  createWorkbenchBreadcrumbController,
} from "../controllers/breadcrumbs/breadcrumb-registry";
export type {
  CreateWorkbenchPageBreadcrumbItemsInput,
  WorkbenchPageBreadcrumbItem,
} from "../controllers/breadcrumbs/page-breadcrumb-projection";
export { createWorkbenchPageBreadcrumbItems } from "../controllers/breadcrumbs/page-breadcrumb-projection";
export type {
  CreateWorkbenchCommandPaletteControllerInput,
  WorkbenchCommandPaletteChangeListener,
  WorkbenchCommandPaletteController,
  WorkbenchCommandPaletteOpenInput,
  WorkbenchCommandPaletteState,
  WorkbenchCommandPaletteView,
} from "../controllers/command-palette/command-palette-controller";
export { createWorkbenchCommandPaletteController } from "../controllers/command-palette/command-palette-controller";
export type {
  WorkbenchCompositionAddablePanel,
  WorkbenchCompositionController,
  WorkbenchCompositionRegionPanels,
} from "../controllers/composition/composition-controller";
export { createWorkbenchCompositionController } from "../controllers/composition/composition-controller";
export type {
  CreateWorkbenchFocusControllerInput,
  WorkbenchFocusChangeListener,
  WorkbenchFocusController,
  WorkbenchFocusRegionId,
  WorkbenchFocusState,
} from "../controllers/focus/focus-controller";
export { createWorkbenchFocusController, workbenchFocusRegions } from "../controllers/focus/focus-controller";
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
} from "../controllers/history/history-controller";
export { createHistoryController } from "../controllers/history/history-controller";
export type {
  CreateWorkbenchLastResourceControllerInput,
  LastResourcePersistenceAdapter,
  WorkbenchLastResourceController,
} from "../controllers/last-resource/last-resource-controller";
export { createWorkbenchLastResourceController } from "../controllers/last-resource/last-resource-controller";
export {
  createWorkbenchNavigator,
  type WorkbenchNavigationCommit,
  type WorkbenchNavigationDiagnosticCode,
  type WorkbenchNavigationResult,
  type WorkbenchNavigationTarget,
  type WorkbenchNavigator,
  type WorkbenchNavigatorHostHooks,
} from "../controllers/navigator/workbench-navigator";
export type {
  CreateWorkbenchPageLocationControllerInput,
  WorkbenchPageBrowserEntry,
  WorkbenchPageHistoryState,
  WorkbenchPageLocationBrowser,
  WorkbenchPageLocationController,
  WorkbenchPageLocationDiagnostic,
  WorkbenchPageLocationPersistence,
  WorkbenchPageNavigationResult,
} from "../controllers/page-location/page-location-controller";
export { createWorkbenchPageLocationController } from "../controllers/page-location/page-location-controller";
export {
  workbenchPageLocationKey,
  workbenchPageLocationRouteKey,
  workbenchPageLocationsEqual,
} from "../controllers/page-location/page-location-normalization";
export type {
  CreateWorkbenchPanelTargetControllerInput,
  WorkbenchPanelTargetBatchResult,
  WorkbenchPanelTargetController,
  WorkbenchPanelTargetDiagnostic,
  WorkbenchPanelTargetResult,
} from "../controllers/panel-target/panel-target-controller";
export { createWorkbenchPanelTargetController } from "../controllers/panel-target/panel-target-controller";
export type {
  CreateWorkbenchPanelsControllerInput,
  PersistedWorkbenchPanels,
  WorkbenchPanelsChangeListener,
  WorkbenchPanelsController,
  WorkbenchPanelsPersistenceAdapter,
  WorkbenchPanelsState,
} from "../controllers/panels/panels-controller";
export { createWorkbenchPanelsController } from "../controllers/panels/panels-controller";
export type {
  WorkbenchShellController,
  WorkbenchShellOpenRegion,
  WorkbenchShellRegionState,
  WorkbenchSidePanelPresentation,
} from "../controllers/shell/shell-controller";
export type {
  CreateWorkbenchSidePanelControllerInput,
  WorkbenchSidePanelChangeListener,
  WorkbenchSidePanelController,
  WorkbenchSidePanelMode,
  WorkbenchSidePanelPersistenceAdapter,
  WorkbenchSidePanelState,
} from "../controllers/side-panel/side-panel-controller";
export { createWorkbenchSidePanelController } from "../controllers/side-panel/side-panel-controller";
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
} from "../controllers/terminal/terminal-controller";
export { createWorkbenchTerminalController } from "../controllers/terminal/terminal-controller";
