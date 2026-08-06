import type { WorkbenchBreadcrumbController } from "./controllers/breadcrumbs/breadcrumb-registry";
import type { WorkbenchCommandPaletteController } from "./controllers/command-palette/command-palette-controller";
import type { WorkbenchFocusController } from "./controllers/focus/focus-controller";
import type { HistoryController, WorkbenchHistoryPersistence } from "./controllers/history/history-controller";
import type {
  LastResourcePersistenceAdapter,
  WorkbenchLastResourceController,
} from "./controllers/last-resource/last-resource-controller";
import type {
  WorkbenchPanelsController,
  WorkbenchPanelsPersistenceAdapter,
} from "./controllers/panels/panels-controller";
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
} from "./registries/layout/layout-model";
import type { MenuRegistry } from "./registries/menus/menu-registry";
import type { WorkbenchModeRegistry } from "./registries/modes/mode-registry";
import type { NavigationRegistry } from "./registries/navigation/navigation-registry";
import type { NotificationRegistry } from "./registries/notifications/notification-registry";
import type { PreferencePersistenceAdapter, PreferenceRegistry } from "./registries/preferences/preference-registry";
import type { ControlsRendererRegistry } from "./registries/renderers/controls-renderer-registry";
import type { DataTableRendererRegistry } from "./registries/renderers/data-table-renderer-registry";
import type { FileRendererRegistry } from "./registries/renderers/file-renderer-registry";
import type { KanbanRendererRegistry } from "./registries/renderers/kanban-renderer-registry";
import type {
  CreateWorkbenchRendererRegistryInput,
  WorkbenchRendererRegistry,
} from "./registries/renderers/renderer-registry";
import type {
  TreeRendererPersistenceAdapter,
  TreeRendererRegistry,
} from "./registries/renderers/tree-renderer-registry";
import type { ResourceRef, ResourceRegistry } from "./registries/resources/resource-registry";
import type { SettingsRegistry } from "./registries/settings/settings-registry";
import type { FileIconThemeRegistry } from "./registries/themes/file-icon-theme-registry";
import type { ThemeRegistry } from "./registries/themes/theme-registry";
import type { ContextKeyService } from "./shared/context/context-key-service";
import type { ContributionSource } from "./shared/contributions/metadata";
import type { Disposable } from "./shared/disposable";

// Layout owns both spatial placements and command-to-menu-path bindings.
export type WorkbenchLayoutModel = LayoutModel & MenuRegistry;

// Specialized renderers auto-register widget renderers, so they share one namespace.
export type WorkbenchRenderers = WorkbenchRendererRegistry &
  TreeRendererRegistry &
  KanbanRendererRegistry &
  DataTableRendererRegistry &
  FileRendererRegistry &
  ControlsRendererRegistry;

export interface WorkbenchCoreContributionContext {
  breadcrumbs: WorkbenchBreadcrumbController;
  commandPalette: WorkbenchCommandPaletteController;
  commandPaletteResources: CommandPaletteResourceRegistry;
  commands: CommandRegistry;
  context: ContextKeyService;
  focus: WorkbenchFocusController;
  history: HistoryController;
  keybindings: KeybindingRegistry;
  lastResource: WorkbenchLastResourceController;
  layout: WorkbenchLayoutModel;
  modes: WorkbenchModeRegistry;
  navigation: NavigationRegistry;
  notifications: NotificationRegistry;
  panels: WorkbenchPanelsController;
  preferences: PreferenceRegistry;
  renderers: WorkbenchRenderers;
  resources: ResourceRegistry;
  settings: SettingsRegistry;
  shell: WorkbenchShellController;
  sidePanel: WorkbenchSidePanelController;
  terminal: WorkbenchTerminalController;
  themes: ThemeRegistry;
  fileIconThemes: FileIconThemeRegistry;
  getPrimaryResource(): ResourceRef | undefined;
  onDidChangePrimaryResource(listener: (resource: ResourceRef | undefined) => void): Disposable;
  getActiveResource(): ResourceRef | undefined;
  onDidChangeActiveResource(listener: (resource: ResourceRef | undefined) => void): Disposable;
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
  registerModule(module: WorkbenchModuleContribution): Disposable;
  unregisterModule(moduleId: string): void;
}

export type WorkbenchModuleContext = WorkbenchCoreContributionContext;
export type WorkbenchModuleContributionContext = WorkbenchModuleContext;

export interface CreateWorkbenchCoreInput {
  isInScope?: (resource: ResourceRef, primary: ResourceRef | undefined) => boolean;
  layoutPersistence?: LayoutPersistenceAdapter;
  persistence?: WorkbenchPersistenceAdapter;
  historyPersistence?: WorkbenchHistoryPersistence;
  preferencePersistence?: PreferencePersistenceAdapter;
  treePersistence?: TreeRendererPersistenceAdapter;
  panelsPersistence?: WorkbenchPanelsPersistenceAdapter;
  defaultPanelOpenByRegionId?: Partial<Record<WorkbenchRegion, boolean>>;
  lastResourcePersistence?: LastResourcePersistenceAdapter;
  sidePanelPersistence?: WorkbenchSidePanelPersistenceAdapter;
  initialSidePanelMode?: WorkbenchSidePanelMode;
  renderers?: CreateWorkbenchRendererRegistryInput;
}

type WorkbenchModuleActivationResult = Disposable | readonly Disposable[] | undefined;

export interface WorkbenchModuleContribution {
  id: string;
  source?: ContributionSource;
  ownerId?: string;
  activate(ctx: WorkbenchModuleContributionContext): WorkbenchModuleActivationResult;
}
