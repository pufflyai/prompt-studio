import type { PageRef } from "@pstdio/sdk/extensions";
import type { WorkbenchBreadcrumbController } from "./controllers/breadcrumbs/breadcrumb-registry";
import type { WorkbenchCommandPaletteController } from "./controllers/command-palette/command-palette-controller";
import type { WorkbenchCompositionController } from "./controllers/composition/composition-controller";
import type { WorkbenchFocusController } from "./controllers/focus/focus-controller";
import type {
  WorkbenchPageLocationBrowser,
  WorkbenchPageLocationController,
  WorkbenchPageLocationPersistence,
} from "./controllers/page-location/page-location-controller";
import type {
  WorkbenchPanelMenuStateController,
  WorkbenchPanelMenuStatePersistenceAdapter,
} from "./controllers/panel-menus/panel-menu-state-controller";
import type { WorkbenchShellController } from "./controllers/shell/shell-controller";
import type {
  WorkbenchSidePanelController,
  WorkbenchSidePanelMode,
  WorkbenchSidePanelPersistenceAdapter,
} from "./controllers/side-panel/side-panel-controller";
import type { WorkbenchTerminalController } from "./controllers/terminal/terminal-controller";
import type { CommandPaletteResourceRegistry } from "./registries/command-palette-resources/command-palette-resource-registry";
import type { CommandRegistry } from "./registries/commands/command-registry";
import type { KeybindingRegistry } from "./registries/keybindings/keybinding-registry";
import type {
  LayoutModel,
  LayoutPersistenceAdapter,
  WorkbenchLayout,
  WorkbenchRegion,
  WorkbenchRegionSettings,
  WorkbenchWidgetPlacement,
} from "./registries/layout/layout-model";
import type { MenuRegistry } from "./registries/menus/menu-registry";
import type { WorkbenchModePlacementRegistry } from "./registries/modes/mode-placement-registry";
import type { WorkbenchModeRegistry } from "./registries/modes/mode-registry";
import type { NavigationRegistry } from "./registries/navigation/navigation-registry";
import type { NavigationTreeRegistry } from "./registries/navigation/navigation-tree-registry";
import type { NotificationRegistry } from "./registries/notifications/notification-registry";
import type { WorkbenchOverlayRegistry } from "./registries/overlays/overlay-registry";
import type { WorkbenchPageRegistry, WorkbenchPageResourceCodec } from "./registries/pages/page-registry";
import type { WorkbenchPlaceholderRegistry } from "./registries/placeholders/placeholder-registry";
import type { WorkbenchShellPlacementRegistry } from "./registries/placements/shell-placement-registry";
import type { PreferencePersistenceAdapter, PreferenceRegistry } from "./registries/preferences/preference-registry";
import type { ControlsRendererRegistry } from "./registries/renderers/controls-renderer-registry";
import type { DataTableRendererRegistry } from "./registries/renderers/data-table-renderer-registry";
import type { FileRendererRegistry } from "./registries/renderers/file-renderer-registry";
import type { KanbanRendererRegistry } from "./registries/renderers/kanban-renderer-registry";
import type { WorkbenchRendererRegistry } from "./registries/renderers/renderer-registry";
import type {
  TreeRendererPersistenceAdapter,
  TreeRendererRegistry,
} from "./registries/renderers/tree-renderer-registry";
import type { ResourceRef, ResourceRegistry } from "./registries/resources/resource-registry";
import type { SettingsRegistry } from "./registries/settings/settings-registry";
import type { WorkbenchStatusBarRegistry } from "./registries/status-bar/status-bar-registry";
import type { WorkbenchStatusRegistry } from "./registries/statuses/status-registry";
import type { FileIconThemeRegistry } from "./registries/themes/file-icon-theme-registry";
import type { ThemeRegistry } from "./registries/themes/theme-registry";
import type { WorkbenchViewMenuRegistry } from "./registries/view-menus/view-menu-registry";
import type { WorkbenchViewRegistry } from "./registries/views/view-registry";
import type { ContextKeyService } from "./shared/context/context-key-service";
import type { ContributionSource } from "./shared/contributions/metadata";
import type { Disposable } from "./shared/disposable";

export type WorkbenchLayoutModel = LayoutModel & MenuRegistry;

export type WorkbenchModuleLayoutModel = Omit<
  WorkbenchLayoutModel,
  "registerPanel" | "registerWidget" | "openPanel" | "openWidget" | "registerPlaceholder" | "registerPanelMenu"
>;

export type WorkbenchRenderers = WorkbenchRendererRegistry &
  TreeRendererRegistry &
  KanbanRendererRegistry &
  DataTableRendererRegistry &
  FileRendererRegistry &
  ControlsRendererRegistry;

export type WorkbenchTreeViews = Pick<
  TreeRendererRegistry,
  "getTreeState" | "setNodeExpanded" | "setSectionExpanded" | "setSelectedNode"
>;

export interface WorkbenchCoreContributionContext {
  breadcrumbs: WorkbenchBreadcrumbController;
  commandPalette: WorkbenchCommandPaletteController;
  commandPaletteResources: CommandPaletteResourceRegistry;
  commands: CommandRegistry;
  composition: WorkbenchCompositionController;
  context: ContextKeyService;
  focus: WorkbenchFocusController;
  keybindings: KeybindingRegistry;
  layout: WorkbenchModuleLayoutModel;
  modes: WorkbenchModeRegistry;
  modePlacements: WorkbenchModePlacementRegistry;
  shellPlacements: WorkbenchShellPlacementRegistry;
  navigation: NavigationRegistry;
  navigationTrees: NavigationTreeRegistry;
  notifications: NotificationRegistry;
  overlays: WorkbenchOverlayRegistry;
  placeholders: WorkbenchPlaceholderRegistry;
  pageLocations: WorkbenchPageLocationController;
  pages: WorkbenchPageRegistry<WorkbenchWidgetPlacement>;
  panelMenuState: WorkbenchPanelMenuStateController;
  preferences: PreferenceRegistry;
  treeViews: WorkbenchTreeViews;
  resources: ResourceRegistry;
  views: WorkbenchViewRegistry;
  viewMenus: WorkbenchViewMenuRegistry;
  settings: SettingsRegistry;
  statusBar: WorkbenchStatusBarRegistry;
  statuses: WorkbenchStatusRegistry;
  shell: WorkbenchShellController;
  sidePanel: WorkbenchSidePanelController;
  terminal: WorkbenchTerminalController;
  themes: ThemeRegistry;
  fileIconThemes: FileIconThemeRegistry;
  getPrimaryResource(): ResourceRef | undefined;
  onDidChangePrimaryResource(listener: (resource: ResourceRef | undefined) => void): Disposable;
  getActiveResource(): ResourceRef | undefined;
  onDidChangeActiveResource(listener: (resource: ResourceRef | undefined) => void): Disposable;
  registerChildModule(module: WorkbenchModuleContribution): Disposable;
}

export interface WorkbenchSnapshot {
  layout: WorkbenchLayout;
}

export interface WorkbenchPersistenceAdapter {
  getSnapshot(scope?: string): WorkbenchSnapshot | undefined;
  setSnapshot(snapshot: WorkbenchSnapshot, scope?: string): void;
  flush?(): void;
  dispose?(): void;
}

export interface WorkbenchHost {
  getSnapshot(): WorkbenchSnapshot;
  restoreSnapshot(snapshot: WorkbenchSnapshot): void;
  setPersistenceScope(scope: string | undefined, input?: { carryRegions?: readonly WorkbenchRegion[] }): void;
  getPersistenceScope(): string | undefined;
}

export interface WorkbenchCore extends WorkbenchCoreContributionContext {
  host: WorkbenchHost;
  layout: WorkbenchLayoutModel;
  registerModule(module: WorkbenchModuleContribution): Disposable;
  unregisterModule(moduleId: string): void;
}

export type WorkbenchModuleContext = WorkbenchCoreContributionContext;
export type WorkbenchModuleContributionContext = WorkbenchModuleContext;

export interface WorkbenchPagePersistenceScopeInput {
  currentScope?: string;
  modeId?: string;
  pageId?: string;
  projectId?: string;
  resource?: ResourceRef;
}

export interface WorkbenchPagePersistenceScope {
  scope?: string;
  carryRegions?: readonly WorkbenchRegion[];
}

export interface createWorkbenchInput {
  isInScope?: (resource: ResourceRef, primary: ResourceRef | undefined) => boolean;
  layoutPersistence?: LayoutPersistenceAdapter;
  pageLocationBrowser?: WorkbenchPageLocationBrowser;
  pageLocationPersistence?: WorkbenchPageLocationPersistence;
  resolvePagePersistenceScope?(input: WorkbenchPagePersistenceScopeInput): WorkbenchPagePersistenceScope;
  pageResources?: WorkbenchPageResourceCodec;
  persistence?: WorkbenchPersistenceAdapter;
  preferencePersistence?: PreferencePersistenceAdapter;
  treePersistence?: TreeRendererPersistenceAdapter;
  panelMenuStatePersistence?: WorkbenchPanelMenuStatePersistenceAdapter;
  defaultPanelOpenByRegionId?: Partial<Record<WorkbenchRegion, boolean>>;
  /** Host-level region layout policy. The active mode's regionSettings win over it. */
  regionSettings?: Partial<Record<WorkbenchRegion, WorkbenchRegionSettings>>;
  sidePanelPersistence?: WorkbenchSidePanelPersistenceAdapter;
  /** Default floating policy. The active mode may override it. */
  floatingPanels?: "visible" | "hidden";
  initialSidePanelMode?: WorkbenchSidePanelMode;
  startPage?: PageRef;
}

type WorkbenchModuleActivationResult = Disposable | readonly Disposable[] | undefined;

export interface WorkbenchModuleContribution {
  id: string;
  source?: ContributionSource;
  ownerId?: string;
  activate(ctx: WorkbenchModuleContributionContext): WorkbenchModuleActivationResult;
}
