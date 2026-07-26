import {
  createWorkbenchBreadcrumbController,
  type WorkbenchBreadcrumbController,
} from "./controllers/breadcrumbs/breadcrumb-registry";
import {
  createWorkbenchCommandPaletteController,
  type WorkbenchCommandPaletteController,
} from "./controllers/command-palette/command-palette-controller";
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
import {
  createWorkbenchPanelsController,
  type WorkbenchPanelsController,
  type WorkbenchPanelsPersistenceAdapter,
} from "./controllers/panels/panels-controller";
import { createPrimaryCoordinator, createScopedIsInScope } from "./controllers/primary-coordinator/primary-coordinator";
import {
  createWorkbenchSidePanelController,
  type WorkbenchSidePanelController,
  type WorkbenchSidePanelMode,
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
import { createDataRendererRegistry, type DataRendererRegistry } from "./registries/renderers/data-renderer-registry";
import {
  createDataTableRendererRegistry,
  type DataTableRendererRegistry,
} from "./registries/renderers/data-table-renderer-registry";
import { createFileRendererRegistry, type FileRendererRegistry } from "./registries/renderers/file-renderer-registry";
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
import { createFileIconThemeRegistry, type FileIconThemeRegistry } from "./registries/themes/file-icon-theme-registry";
import { createThemeRegistry, type ThemeRegistry } from "./registries/themes/theme-registry";
import { type ContextKeyService, createContextKeyService } from "./shared/context/context-key-service";
import type { ContributionMetadata, ContributionSource } from "./shared/contributions/metadata";
import type { Disposable } from "./shared/disposable";
import { createDisposable } from "./shared/disposable";
import { registerWorkbenchBuiltIns } from "./workbench-built-ins";

// The workbench layout namespace owns both spatial placements (widgets,
// placeholders) and command-to-menu-path bindings. Menus collapsed into layout
// because a menu item is just another "bind X to a place" contribution.
export type WorkbenchLayoutModel = LayoutModel & MenuRegistry;

// The renderer namespace owns content-producing registrations. Tree renderers
// and data renderers live here too: each auto-registers a widget renderer so
// they are placed via layout.registerWidget like any other content.
export type WorkbenchRenderers = WorkbenchRendererRegistry &
  TreeRendererRegistry &
  DataRendererRegistry &
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
}

export interface WorkbenchCore extends WorkbenchCoreContributionContext {
  registerModule(module: WorkbenchModuleContribution): Disposable;
  unregisterModule(moduleId: string): void;
}

export type WorkbenchModuleContributionContext = WorkbenchCoreContributionContext;

export interface CreateWorkbenchCoreInput {
  // Whether a detached anchor's resource still belongs to the active primary's scope.
  // Defaults to keeping detached anchors; apps wire this once scoped providers exist.
  isInScope?: (resource: ResourceRef, primary: ResourceRef | undefined) => boolean;
  layoutPersistence?: LayoutPersistenceAdapter;
  historyPersistence?: WorkbenchHistoryPersistence;
  preferencePersistence?: PreferencePersistenceAdapter;
  treePersistence?: TreeRendererPersistenceAdapter;
  panelsPersistence?: WorkbenchPanelsPersistenceAdapter;
  defaultPanelOpenByRegionId?: Partial<Record<WorkbenchRegion, boolean>>;
  lastResourcePersistence?: LastResourcePersistenceAdapter;
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

  const context = {
    ...core,
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
    layout: {
      ...core.layout,
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
      registerWidget: (widget, metadata) =>
        track(core.layout.registerWidget(widget, withModuleMetadata(input, metadata))),
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
      registerDataRenderer: (contribution, metadata) =>
        track(core.renderers.registerDataRenderer(contribution, withModuleMetadata(input, metadata))),
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
      registerOpener: (opener) => track(core.resources.registerOpener(opener)),
      registerProvider: (provider) => track(core.resources.registerProvider(provider)),
      onDidOpenResource: (listener) => track(core.resources.onDidOpenResource(listener)),
    },
    settings: {
      ...core.settings,
      registerSection: (section, metadata) =>
        track(core.settings.registerSection(section, withModuleMetadata(input, metadata))),
      registerPanel: (panel, metadata) =>
        track(core.settings.registerPanel(panel, withModuleMetadata(input, metadata))),
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

export const createWorkbenchCore = (input: CreateWorkbenchCoreInput = {}) => {
  const context = createContextKeyService();
  const commands = createCommandRegistry({ context });
  const moduleRecords = new Map<string, { disposable: Disposable }>();
  const rendererRegistry = createWorkbenchRendererRegistry(input.renderers);
  const treeRendererRegistry = createTreeRendererRegistry({
    rendererRegistry,
    persistence: input.treePersistence,
  });
  const dataRendererRegistry = createDataRendererRegistry({ rendererRegistry });
  const dataTableRendererRegistry = createDataTableRendererRegistry({ rendererRegistry });
  const fileRendererRegistry = createFileRendererRegistry({ rendererRegistry });
  const controlsRendererRegistry = createControlsRendererRegistry({ rendererRegistry });
  const layout = {
    ...createLayoutModel({
      defaultRegionVisibility: input.defaultPanelOpenByRegionId,
      persistence: input.layoutPersistence,
    }),
    ...createMenuRegistry({ commands }),
  };
  const focus = createWorkbenchFocusController({
    context,
    isRegionFocusable: (region) => layout.getLayout().regions[region].visible,
  });

  const core: WorkbenchCore = {
    breadcrumbs: createWorkbenchBreadcrumbController(),
    commandPalette: createWorkbenchCommandPaletteController(),
    commands,
    context,
    focus,
    history: undefined as unknown as HistoryController,
    keybindings: createKeybindingRegistry({ commands, context }),
    lastResource: createWorkbenchLastResourceController({
      persistence: input.lastResourcePersistence,
      openResource: (resource) => core.resources.openResource(resource, { replaceActive: true }),
    }),
    layout,
    modes: undefined as unknown as WorkbenchModeRegistry,
    notifications: createNotificationRegistry(),
    navigation: createNavigationRegistry({
      resolveDispatcher: () => ({
        createCheckpoint: () => {
          const layout = core.layout.getLayout();
          return () => core.layout.restoreLayout(layout);
        },
        canOpenResource: (resource) => {
          const state = core.resources.store.getState();
          return Boolean(
            state.kinds[resource.kind] && Object.values(state.openers).some((opener) => opener.canOpen(resource)),
          );
        },
        canOpenWidget: (widgetId) => Boolean(core.layout.getWidget(widgetId)),
        canExecuteCommand: (commandId) => Boolean(core.commands.getCommand(commandId)),
        openResource: (resource, openInput) => core.resources.openResource(resource, openInput),
        openWidget: (widgetId, openInput) => {
          const placement = core.layout.openWidget(widgetId, openInput);
          // Navigation is ingress — revealing the view is part of the intent.
          // The region might be hidden (panel collapsed, persisted state); make
          // sure the user can actually see the widget they navigated to.
          const widget = core.layout.getWidget(widgetId);
          const region = openInput?.region ?? widget?.region;
          if (region) {
            core.layout.setRegionVisible(region, true);
            if (!core.panels.isOpen(region)) core.panels.setOpen(region, true);
          }
          return placement;
        },
        executeCommand: (commandId, args) => core.commands.executeCommand(commandId, args),
      }),
    }),
    panels: createWorkbenchPanelsController({
      defaultOpenByRegionId: input.defaultPanelOpenByRegionId,
      persistence: input.panelsPersistence,
    }),
    preferences: createPreferenceRegistry({ persistence: input.preferencePersistence }),
    renderers: {
      ...rendererRegistry,
      ...treeRendererRegistry,
      ...dataRendererRegistry,
      ...dataTableRendererRegistry,
      ...fileRendererRegistry,
      ...controlsRendererRegistry,
    },
    commandPaletteResources: createCommandPaletteResourceRegistry(),
    resources: createResourceRegistry({
      getPrimary: () => getActiveLocationPlacement(core.layout.getLayout())?.resource,
    }),
    settings: createSettingsRegistry(),
    sidePanel: createWorkbenchSidePanelController({ initialMode: input.initialSidePanelMode }),
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

  core.modes = createWorkbenchModeRegistry({ resolveContext: () => core });
  core.history = createHistoryController({
    layout: core.layout,
    modes: core.modes,
    resources: core.resources,
    persistence: input.historyPersistence,
  });

  core.layout.store.subscribe((state) => {
    const activeRegion = core.focus.getActiveRegion();
    if (activeRegion && !state.layout.regions[activeRegion].visible) core.focus.clearFocus();
  });

  // The panels controller is workbench-global, but layout region visibility is
  // per-scope. After a scope switch, mirror each region's `visible` flag into
  // panels so the panel chrome (collapse/expand) reflects the loaded scope —
  // otherwise the previous scope's collapse state sticks around visually.
  core.layout.onDidChangePersistenceScope(() => {
    const layout = core.layout.getLayout();
    for (const region of Object.values(layout.regions)) {
      core.panels.setOpen(region.id, region.visible);
    }
  });

  // Persist the last PRIMARY (main) resource so apps can call `lastResource.restore()`
  // on next boot. We track the primary, not the global active resource: "where you were"
  // is the main subject (workspace/ticket), not a transient supporting selection like a
  // Side Panel session — those are detached and scoped, so they are intentionally not restored.
  core.onDidChangePrimaryResource((resource) => {
    if (resource) core.lastResource.set(resource);
  });

  // Keep the secondary resource anchors (derived/detached) consistent with the primary
  // (main) resource. The default scope predicate keeps detached anchors; apps inject
  // `isInScope` once scoped resource providers exist.
  createPrimaryCoordinator({
    layout: core.layout,
    isInScope: input.isInScope ?? createScopedIsInScope(core.resources),
  });

  registerWorkbenchBuiltIns(core);

  return core;
};
