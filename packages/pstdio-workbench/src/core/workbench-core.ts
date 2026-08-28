import {
  createWorkbenchBreadcrumbController,
  type WorkbenchBreadcrumbController,
} from "./controllers/breadcrumbs/breadcrumb-registry";
import {
  createWorkbenchCommandPaletteController,
  type WorkbenchCommandPaletteController,
} from "./controllers/command-palette/command-palette-controller";
import {
  createWorkbenchCompositionController,
  type WorkbenchCompositionController,
} from "./controllers/composition/composition-controller";
import { createWorkbenchFocusController, type WorkbenchFocusController } from "./controllers/focus/focus-controller";
import {
  createHistoryController,
  type HistoryController,
  type WorkbenchHistoryPersistence,
} from "./controllers/history/history-controller";
import {
  createWorkbenchLastResourceController,
  type LastResourcePersistenceAdapter,
  type WorkbenchLastResourceController,
} from "./controllers/last-resource/last-resource-controller";
import { createWorkbenchNavigator, type WorkbenchNavigator } from "./controllers/navigator/workbench-navigator";
import {
  createWorkbenchPanelsController,
  type WorkbenchPanelsController,
  type WorkbenchPanelsPersistenceAdapter,
} from "./controllers/panels/panels-controller";
import { createPrimaryCoordinator, createScopedIsInScope } from "./controllers/primary-coordinator/primary-coordinator";
import {
  createWorkbenchShellController,
  isWorkbenchShellOpenRegion,
  type WorkbenchShellController,
} from "./controllers/shell/shell-controller";
import {
  createWorkbenchSidePanelController,
  type WorkbenchSidePanelController,
  type WorkbenchSidePanelMode,
  type WorkbenchSidePanelPersistenceAdapter,
} from "./controllers/side-panel/side-panel-controller";
import {
  createWorkbenchTerminalController,
  type WorkbenchTerminalController,
} from "./controllers/terminal/terminal-controller";
import {
  type CommandPaletteResourceRegistry,
  createCommandPaletteResourceRegistry,
} from "./registries/command-palette-resources/command-palette-resource-registry";
import { type CommandRegistry, createCommandRegistry } from "./registries/commands/command-registry";
import { createKeybindingRegistry, type KeybindingRegistry } from "./registries/keybindings/keybinding-registry";
import {
  createLayoutModel,
  type LayoutModel,
  type LayoutPersistenceAdapter,
  type OpenWorkbenchPanelInput,
  type WorkbenchLayout,
  type WorkbenchRegion,
} from "./registries/layout/layout-model";
import { getActiveLocationPlacement } from "./registries/layout/layout-operations";
import { createMenuRegistry, type MenuRegistry } from "./registries/menus/menu-registry";
import { createWorkbenchModeRegistry, type WorkbenchModeRegistry } from "./registries/modes/mode-registry";
import { createNavigationRegistry, type NavigationRegistry } from "./registries/navigation/navigation-registry";
import {
  createNotificationRegistry,
  type NotificationRegistry,
} from "./registries/notifications/notification-registry";
import {
  createPreferenceRegistry,
  type PreferencePersistenceAdapter,
  type PreferenceRegistry,
} from "./registries/preferences/preference-registry";
import {
  type ControlsRendererRegistry,
  createControlsRendererRegistry,
} from "./registries/renderers/controls-renderer-registry";
import {
  createDataTableRendererRegistry,
  type DataTableRendererRegistry,
} from "./registries/renderers/data-table-renderer-registry";
import { createFileRendererRegistry, type FileRendererRegistry } from "./registries/renderers/file-renderer-registry";
import {
  createKanbanRendererRegistry,
  type KanbanRendererRegistry,
} from "./registries/renderers/kanban-renderer-registry";
import {
  type CreateWorkbenchRendererRegistryInput,
  createWorkbenchRendererRegistry,
  type WorkbenchRendererRegistry,
} from "./registries/renderers/renderer-registry";
import {
  createTreeRendererRegistry,
  type TreeRendererPersistenceAdapter,
  type TreeRendererRegistry,
} from "./registries/renderers/tree-renderer-registry";
import {
  createResourceRegistry,
  type ResourceRef,
  type ResourceRegistry,
} from "./registries/resources/resource-registry";
import { createSettingsRegistry, type SettingsRegistry } from "./registries/settings/settings-registry";
import { createStatusBarRegistry, type WorkbenchStatusBarRegistry } from "./registries/status-bar/status-bar-registry";
import { createStatusRegistry, type WorkbenchStatusRegistry } from "./registries/statuses/status-registry";
import { createFileIconThemeRegistry, type FileIconThemeRegistry } from "./registries/themes/file-icon-theme-registry";
import { createThemeRegistry, type ThemeRegistry } from "./registries/themes/theme-registry";
import {
  createViewRegistry,
  type WorkbenchViewRegistry,
  workbenchViewIdContextKey,
} from "./registries/views/view-registry";
import { type ContextKeyService, createContextKeyService } from "./shared/context/context-key-service";
import type { ContributionMetadata, ContributionSource } from "./shared/contributions/metadata";
import type { Disposable } from "./shared/disposable";
import { createDisposable } from "./shared/disposable";
import { registerWorkbenchBuiltIns } from "./workbench-built-ins";

// The workbench layout namespace owns both spatial placements (widgets,
// placeholders) and command-to-menu-path bindings. Menus collapsed into layout
// because a menu item is just another "bind X to a place" contribution.
export type WorkbenchLayoutModel = LayoutModel & MenuRegistry;

// Extension modules place declared views. Widget registration is an internal
// implementation detail used by the workbench's renderer and panel registries.
export type WorkbenchModuleLayoutModel = Omit<WorkbenchLayoutModel, "registerWidget">;

// The renderer namespace owns content-producing registrations. Tree renderers
// and kanban renderers live here too: each connects its content to an internal
// view-backed widget renderer.
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
  composition: WorkbenchCompositionController;
  context: ContextKeyService;
  focus: WorkbenchFocusController;
  history: HistoryController;
  keybindings: KeybindingRegistry;
  lastResource: WorkbenchLastResourceController;
  layout: WorkbenchModuleLayoutModel;
  modes: WorkbenchModeRegistry;
  navigation: NavigationRegistry;
  navigator: WorkbenchNavigator;
  notifications: NotificationRegistry;
  panels: WorkbenchPanelsController;
  preferences: PreferenceRegistry;
  renderers: WorkbenchRenderers;
  resources: ResourceRegistry;
  views: WorkbenchViewRegistry;
  settings: SettingsRegistry;
  statusBar: WorkbenchStatusBarRegistry;
  statuses: WorkbenchStatusRegistry;
  shell: WorkbenchShellController;
  sidePanel: WorkbenchSidePanelController;
  terminal: WorkbenchTerminalController;
  themes: ThemeRegistry;
  fileIconThemes: FileIconThemeRegistry;
  // The resource hosted by the primary (main) anchor specifically — free of the global
  // active-resource pollution that any side-region activation introduces. Projections
  // (side panels, headers) follow this signal, not the global active resource.
  getPrimaryResource(): ResourceRef | undefined;
  onDidChangePrimaryResource(listener: (resource: ResourceRef | undefined) => void): Disposable;
  // The globally-focused resource — includes side-anchor selections. Extension hosts
  // (command palette, etc.) read this so they reflect whatever the user is acting on.
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

export interface CreateWorkbenchCoreInput {
  // Whether a detached anchor's resource still belongs to the active primary's scope.
  // Defaults to keeping detached anchors; apps wire this once scoped providers exist.
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

const withModuleMetadata = (
  input: { ownerId: string; source: ContributionSource },
  metadata?: ContributionMetadata,
) => ({
  ...metadata,
  source: input.source,
  ownerId: input.ownerId,
});

const toDisposables = (result: WorkbenchModuleActivationResult) => {
  if (!result) return [] as Disposable[];
  return Array.isArray(result) ? [...result] : [result as Disposable];
};

const disposeDisposables = (disposables: Disposable[]) => {
  for (let index = disposables.length - 1; index >= 0; index -= 1) {
    disposables[index]?.dispose();
  }
};

interface CreateModuleContextInput {
  ownerId: string;
  source: ContributionSource;
  track(disposable: Disposable): void;
}

const createModuleContext = (core: WorkbenchCore, input: CreateModuleContextInput) => {
  const contextScope = core.context.createScope(input.ownerId);
  input.track(contextScope);

  const track = <TDisposable extends Disposable>(disposable: TDisposable) => {
    input.track(disposable);
    return disposable;
  };

  const { registerWidget: _registerWidget, ...moduleLayout } = core.layout;

  const context = {
    ...core,
    registerChildModule: (module) => track(core.registerModule(module)),
    onDidChangePrimaryResource: (listener: (resource: ResourceRef | undefined) => void) =>
      track(core.onDidChangePrimaryResource(listener)),
    onDidChangeActiveResource: (listener: (resource: ResourceRef | undefined) => void) =>
      track(core.onDidChangeActiveResource(listener)),
    breadcrumbs: {
      ...core.breadcrumbs,
      setItems: (items) => track(core.breadcrumbs.setItems(items)),
      onDidChange: (listener) => track(core.breadcrumbs.onDidChange(listener)),
    },
    commandPalette: {
      ...core.commandPalette,
      onDidChange: (listener) => track(core.commandPalette.onDidChange(listener)),
    },
    context: {
      ...core.context,
      set: (key, value) => contextScope.set(key, value),
      delete: (key) => contextScope.delete(key),
      createScope: (ownerId) => track(core.context.createScope(ownerId)),
    },
    focus: {
      ...core.focus,
      onDidChange: (listener) => track(core.focus.onDidChange(listener)),
    },
    commands: {
      ...core.commands,
      registerCommand: (command, handler, metadata) =>
        track(core.commands.registerCommand(command, handler, withModuleMetadata(input, metadata))),
      onDidExecuteError: (listener) => track(core.commands.onDidExecuteError(listener)),
    },
    keybindings: {
      ...core.keybindings,
      registerKeybinding: (keybinding, metadata) =>
        track(core.keybindings.registerKeybinding(keybinding, withModuleMetadata(input, metadata))),
    },
    lastResource: { ...core.lastResource },
    navigator: core.navigator,
    layout: {
      ...moduleLayout,
      openPanel: (id, openInput) => {
        const instance = core.layout.openPanel(id, openInput);
        track(createDisposable(() => core.layout.removeWidgetPlacement(instance.instanceId)));
        return instance;
      },
      openWidget: (id, openInput) => {
        const placement = core.layout.openWidget(id, {
          ...openInput,
          ownerId: input.ownerId,
          source: input.source,
        });
        track(createDisposable(() => core.layout.removeWidgetPlacement(placement.widgetId)));
        return placement;
      },
      registerPlaceholder: (placeholder, metadata) =>
        track(core.layout.registerPlaceholder(placeholder, withModuleMetadata(input, metadata))),
      registerPanel: (panel, metadata) => track(core.layout.registerPanel(panel, withModuleMetadata(input, metadata))),
      registerLocation: (location, metadata) =>
        track(core.layout.registerLocation(location, withModuleMetadata(input, metadata))),
      registerSubPanel: (subPanel, metadata) =>
        track(core.layout.registerSubPanel(subPanel, withModuleMetadata(input, metadata))),
      registerPanelMenu: (panelMenu, metadata) =>
        track(core.layout.registerPanelMenu(panelMenu, withModuleMetadata(input, metadata))),
      registerMenuItem: (path, item, metadata) =>
        track(core.layout.registerMenuItem(path, item, withModuleMetadata(input, metadata))),
      onWillChangePersistenceScope: (listener) => track(core.layout.onWillChangePersistenceScope(listener)),
      onDidChangePersistenceScope: (listener) => track(core.layout.onDidChangePersistenceScope(listener)),
    },
    modes: {
      ...core.modes,
      registerMode: (mode) =>
        track(
          core.modes.registerMode({
            ...mode,
            activate: () => {
              const modeDisposables: Disposable[] = [];
              const modeContext = createModuleContext(core, {
                ...input,
                track: (disposable) => {
                  modeDisposables.push(disposable);
                },
              });
              const returnedDisposables = toDisposables(mode.activate(modeContext));
              return createDisposable(() => disposeDisposables([...modeDisposables, ...returnedDisposables]));
            },
          }),
        ),
      onDidChangeActive: (listener) => track(core.modes.onDidChangeActive(listener)),
    },
    navigation: {
      ...core.navigation,
      registerNavigator: (navigator, metadata) =>
        track(core.navigation.registerNavigator(navigator, withModuleMetadata(input, metadata))),
      registerParser: (parser, metadata) =>
        track(core.navigation.registerParser(parser, withModuleMetadata(input, metadata))),
    },
    notifications: {
      ...core.notifications,
      show: (notification, metadata) => core.notifications.show(notification, withModuleMetadata(input, metadata)),
    },
    panels: {
      ...core.panels,
      onDidChange: (listener) => track(core.panels.onDidChange(listener)),
    },
    preferences: {
      ...core.preferences,
      registerSchema: (schema, metadata) =>
        track(core.preferences.registerSchema(schema, withModuleMetadata(input, metadata))),
    },
    renderers: {
      ...core.renderers,
      registerRenderer: (renderer) => track(core.renderers.registerRenderer(renderer)),
      registerTreeRenderer: (view, metadata) =>
        track(core.renderers.registerTreeRenderer(view, withModuleMetadata(input, metadata))),
      registerKanbanRenderer: (contribution, metadata) =>
        track(core.renderers.registerKanbanRenderer(contribution, withModuleMetadata(input, metadata))),
      registerDataTableRenderer: (contribution, metadata) =>
        track(core.renderers.registerDataTableRenderer(contribution, withModuleMetadata(input, metadata))),
      registerFileRenderer: (contribution, metadata) =>
        track(core.renderers.registerFileRenderer(contribution, withModuleMetadata(input, metadata))),
      registerControlsRenderer: (contribution, metadata) =>
        track(core.renderers.registerControlsRenderer(contribution, withModuleMetadata(input, metadata))),
      onDidChange: (listener) => track(core.renderers.onDidChange(listener)),
      onDidRefresh: (listener) => track(core.renderers.onDidRefresh(listener)),
    },
    resources: {
      ...core.resources,
      registerKind: (kind, metadata) => track(core.resources.registerKind(kind, withModuleMetadata(input, metadata))),
      registerHierarchyProvider: (provider) => track(core.resources.registerHierarchyProvider(provider)),
      registerPresenter: (presenter) => track(core.resources.registerPresenter(presenter)),
      registerProvider: (provider) => track(core.resources.registerProvider(provider)),
      onDidOpenResource: (listener) => track(core.resources.onDidOpenResource(listener)),
    },
    views: {
      ...core.views,
      registerView: (view, metadata) => track(core.views.registerView(view, withModuleMetadata(input, metadata))),
      onDidOpenView: (listener) => track(core.views.onDidOpenView(listener)),
    },
    settings: {
      ...core.settings,
      registerSection: (section, metadata) =>
        track(core.settings.registerSection(section, withModuleMetadata(input, metadata))),
      registerPanel: (panel, metadata) =>
        track(core.settings.registerPanel(panel, withModuleMetadata(input, metadata))),
    },
    statusBar: {
      ...core.statusBar,
      registerItem: (item) => track(core.statusBar.registerItem(item)),
    },
    statuses: {
      ...core.statuses,
      registerStatusSet: (statusSet, metadata) =>
        track(core.statuses.registerStatusSet(statusSet, withModuleMetadata(input, metadata))),
    },
    shell: {
      ...core.shell,
      onDidChange: (listener) => track(core.shell.onDidChange(listener)),
    },
    sidePanel: {
      ...core.sidePanel,
      onDidChange: (listener) => track(core.sidePanel.onDidChange(listener)),
    },
    themes: {
      ...core.themes,
      register: (themes) => track(core.themes.register(themes)),
    },
    fileIconThemes: {
      ...core.fileIconThemes,
      register: (themes) => track(core.fileIconThemes.register(themes)),
    },
  } satisfies WorkbenchModuleContributionContext;

  return context;
};

const createCoreCompositionController = (core: WorkbenchCore) =>
  createWorkbenchCompositionController({
    getActiveMode: () => {
      const modeId = core.modes.getActiveModeId();
      return modeId ? core.modes.getMode(modeId) : undefined;
    },
    getLayout: core.layout.getLayout,
    getResource: core.getPrimaryResource,
    listWidgets: core.layout.listWidgets,
  });

const connectWorkbenchCoreState = (core: WorkbenchCore, input: CreateWorkbenchCoreInput) => {
  core.layout.store.subscribe((state) => {
    const activeRegion = core.focus.getActiveRegion();
    if (activeRegion && !state.layout.regions[activeRegion].visible) core.focus.clearFocus();
  });
  core.layout.store.subscribeSelector(
    (state) => {
      const activeId = state.layout.activeWidgetId;
      if (!activeId) return undefined;
      return Object.values(state.layout.regions)
        .flatMap((region) => region.widgets)
        .find((placement) => placement.widgetId === activeId)?.viewId;
    },
    (viewId) => {
      if (viewId) core.context.set(workbenchViewIdContextKey, viewId);
      else core.context.delete(workbenchViewIdContextKey);
    },
    { fireImmediately: true },
  );

  // The panels controller is workbench-global, but layout region visibility is
  // per-scope. Mirror scope changes into the panel chrome.
  core.layout.onDidChangePersistenceScope(() => {
    const layout = core.layout.getLayout();
    for (const region of Object.values(layout.regions)) {
      core.panels.setOpen(region.id, region.visible);
    }
  });

  // Supporting selections such as Side Panel sessions do not replace the main subject.
  core.onDidChangePrimaryResource((resource) => {
    if (resource) core.lastResource.set(resource);
  });

  createPrimaryCoordinator({
    layout: core.layout,
    isInScope: input.isInScope ?? createScopedIsInScope(core.resources),
  });
  registerWorkbenchBuiltIns(core);
};

const createCoreNavigationRegistry = (
  resolveCore: () => WorkbenchCore,
  openPanel: WorkbenchCore["layout"]["openPanel"],
) =>
  createNavigationRegistry({
    resolveDispatcher: () => {
      const core = resolveCore();
      return {
        createCheckpoint: () => {
          // The checkpoint covers the navigation state the workbench owns:
          // layout, history, and breadcrumbs. Side effects of commands that
          // already executed belong to their extensions and cannot be undone.
          const layout = core.layout.getLayout();
          const restoreHistory = core.history.createCheckpoint();
          const breadcrumbs = core.breadcrumbs.getItems();
          return () => {
            core.layout.restoreLayout(layout);
            restoreHistory();
            if (breadcrumbs) core.breadcrumbs.setItems(breadcrumbs);
            else core.breadcrumbs.clearItems();
          };
        },
        canOpenResource: (resource) => {
          const state = core.resources.store.getState();
          return Boolean(
            state.kinds[resource.kind] &&
              Object.values(state.presenters).some((presenter) => presenter.canOpen(resource)),
          );
        },
        canOpenPanel: (panelId) => Boolean(core.layout.getPanel(panelId)),
        canOpenView: (viewId) => core.views.canResolveView(viewId),
        canExecuteCommand: (commandId) => Boolean(core.commands.getCommand(commandId)),
        openResource: (resource, openInput) => core.resources.openResource(resource, openInput),
        openPanel,
        openView: (viewId, openInput) => core.views.openView(viewId, openInput),
        executeCommand: (commandId, args) => core.commands.executeCommand(commandId, args),
        openHref: (href) => globalThis.open(href, "_blank", "noopener,noreferrer"),
      };
    },
  });

export const createWorkbenchCore = (input: CreateWorkbenchCoreInput = {}) => {
  const context = createContextKeyService();
  const commands = createCommandRegistry({ context });
  const moduleRecords = new Map<string, { disposable: Disposable }>();
  const rendererRegistry = createWorkbenchRendererRegistry(input.renderers);
  const treeRendererRegistry = createTreeRendererRegistry({
    rendererRegistry,
    persistence: input.treePersistence,
  });
  const kanbanRendererRegistry = createKanbanRendererRegistry({ rendererRegistry });
  const dataTableRendererRegistry = createDataTableRendererRegistry({ rendererRegistry });
  const fileRendererRegistry = createFileRendererRegistry({ rendererRegistry });
  const controlsRendererRegistry = createControlsRendererRegistry({ rendererRegistry });
  const locationAwareLayout = createLayoutModel({
    defaultRegionVisibility: input.defaultPanelOpenByRegionId,
    persistence: input.persistence
      ? {
          getLayout: (scope) => input.persistence?.getSnapshot(scope)?.layout,
          setLayout: (nextLayout, scope) => input.persistence?.setSnapshot({ layout: nextLayout }, scope),
          flush: input.persistence.flush,
          dispose: input.persistence.dispose,
        }
      : input.layoutPersistence,
  });
  const { establishLocation, ...layoutModel } = locationAwareLayout;
  const layout = {
    ...layoutModel,
    ...createMenuRegistry({ commands }),
  };
  const focus = createWorkbenchFocusController({
    context,
    isRegionFocusable: (region) => layout.getLayout().regions[region].visible,
  });
  const sidePanel = createWorkbenchSidePanelController({
    initialMode: input.initialSidePanelMode,
    persistence: input.sidePanelPersistence,
  });
  const shell = createWorkbenchShellController({ layout, sidePanel });
  const openPanel = (panelId: string, openInput: OpenWorkbenchPanelInput = {}) => {
    const opened = layout.openPanel(panelId, openInput);
    const instance = openInput.viewId ? establishLocation(opened.instanceId) : opened;
    const panel = layout.getPanel(panelId);
    const region = openInput.region ?? panel?.region;
    if (region) {
      if (region === "side") shell.setSidePanelPresentation("attached");
      else if (isWorkbenchShellOpenRegion(region)) shell.setRegionOpen(region, true);
    }
    return instance;
  };
  const views = createViewRegistry({ getPanel: layout.getPanel, openPanel });
  const statusBar = createStatusBarRegistry({ hasView: (viewId) => Boolean(views.getView(viewId)) });

  const core: WorkbenchCore = {
    breadcrumbs: createWorkbenchBreadcrumbController(),
    commandPalette: createWorkbenchCommandPaletteController(),
    commands,
    composition: undefined as unknown as WorkbenchCompositionController,
    context,
    focus,
    host: {
      getSnapshot: () => ({ layout: layout.getLayout() }),
      restoreSnapshot: (snapshot) => layout.restoreLayout(snapshot.layout),
      setPersistenceScope: (scope, scopeInput = {}) =>
        layout.setPersistenceScope(scope, { carryRegionState: scopeInput.carryRegions }),
      getPersistenceScope: layout.getPersistenceScope,
    },
    history: undefined as unknown as HistoryController,
    keybindings: createKeybindingRegistry({ commands, context }),
    lastResource: createWorkbenchLastResourceController({
      persistence: input.lastResourcePersistence,
      openResource: (resource) => core.resources.openResource(resource, { replaceActive: true }),
    }),
    layout,
    modes: undefined as unknown as WorkbenchModeRegistry,
    navigator: undefined as unknown as WorkbenchNavigator,
    notifications: createNotificationRegistry(),
    navigation: createCoreNavigationRegistry(() => core, openPanel),
    panels: createWorkbenchPanelsController({
      defaultOpenByRegionId: input.defaultPanelOpenByRegionId,
      persistence: input.panelsPersistence,
    }),
    preferences: createPreferenceRegistry({ persistence: input.preferencePersistence }),
    renderers: {
      ...rendererRegistry,
      ...treeRendererRegistry,
      ...kanbanRendererRegistry,
      ...dataTableRendererRegistry,
      ...fileRendererRegistry,
      ...controlsRendererRegistry,
    },
    commandPaletteResources: createCommandPaletteResourceRegistry(),
    resources: createResourceRegistry({
      getPrimary: () => getActiveLocationPlacement(core.layout.getLayout())?.resource,
      establishLocation: (instance) => establishLocation(instance.instanceId),
      resolveView: (viewId) => core.views.getView(viewId),
    }),
    views,
    settings: createSettingsRegistry(),
    statusBar,
    statuses: createStatusRegistry(),
    shell,
    sidePanel,
    terminal: createWorkbenchTerminalController(),
    themes: createThemeRegistry(),
    fileIconThemes: createFileIconThemeRegistry(),

    getActiveResource() {
      const activeWidgetId = core.layout.getLayout().activeWidgetId;
      if (!activeWidgetId) return undefined;

      for (const region of Object.values(core.layout.getLayout().regions)) {
        const placement = region.widgets.find((candidate) => candidate.widgetId === activeWidgetId);
        if (placement) return placement.resource;
      }

      return undefined;
    },

    onDidChangeActiveResource(listener) {
      return createDisposable(
        core.layout.store.subscribeSelector(
          (state) => state.layout.activeResourceUri,
          () => listener(core.getActiveResource()),
        ),
      );
    },

    getPrimaryResource() {
      return getActiveLocationPlacement(core.layout.getLayout())?.resource;
    },

    onDidChangePrimaryResource(listener) {
      return createDisposable(
        core.layout.store.subscribeSelector(
          (state) => getActiveLocationPlacement(state.layout)?.resourceUri,
          () => listener(core.getPrimaryResource()),
        ),
      );
    },

    registerChildModule(module) {
      return core.registerModule(module);
    },

    registerModule(module) {
      if (moduleRecords.has(module.id)) throw new Error(`Workbench module already registered: ${module.id}`);

      const disposables: Disposable[] = [];
      const record = {
        disposable: undefined as unknown as Disposable,
      };
      record.disposable = createDisposable(() => {
        if (moduleRecords.get(module.id) !== record) return;
        moduleRecords.delete(module.id);
        disposeDisposables(disposables);
      });

      moduleRecords.set(module.id, record);

      try {
        const context = createModuleContext(core, {
          ownerId: module.ownerId ?? module.id,
          source: module.source ?? "module",
          track: (disposable) => {
            disposables.push(disposable);
          },
        });
        disposables.push(...toDisposables(module.activate(context)));
      } catch (error) {
        record.disposable.dispose();
        throw error;
      }

      return record.disposable;
    },

    unregisterModule(moduleId) {
      moduleRecords.get(moduleId)?.disposable.dispose();
    },
  };

  core.modes = createWorkbenchModeRegistry({
    establishLocation: (instanceId) => establishLocation(instanceId),
    resolveContext: () => core,
  });
  core.navigator = createWorkbenchNavigator({
    modes: core.modes,
    getSelectedResource: () => core.getPrimaryResource(),
    presentResource: (resource, present) => core.resources.openResource(resource, present),
  });
  core.composition = createCoreCompositionController(core);
  core.history = createHistoryController({
    layout: core.layout,
    modes: core.modes,
    resources: core.resources,
    views: core.views,
    persistence: input.historyPersistence,
    commitNavigation: (commit) => core.navigator.commitContext(commit),
  });
  core.navigation.registerParser({
    id: "workbench.views.paths",
    priority: 1_000,
    canParse: (location) => Boolean(core.views.resolvePath(location)),
    parse: (location) => core.views.resolvePath(location)!,
  });

  connectWorkbenchCoreState(core, input);

  return core;
};
