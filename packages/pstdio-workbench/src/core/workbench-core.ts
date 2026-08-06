import { createWorkbenchBreadcrumbController } from "./controllers/breadcrumbs/breadcrumb-registry";
import { createWorkbenchCommandPaletteController } from "./controllers/command-palette/command-palette-controller";
import { createWorkbenchFocusController } from "./controllers/focus/focus-controller";
import { createHistoryController } from "./controllers/history/history-controller";
import { createWorkbenchLastResourceController } from "./controllers/last-resource/last-resource-controller";
import { createWorkbenchPanelsController } from "./controllers/panels/panels-controller";
import { createPrimaryCoordinator, createScopedIsInScope } from "./controllers/primary-coordinator/primary-coordinator";
import { createWorkbenchShellController } from "./controllers/shell/shell-controller";
import { createWorkbenchSidePanelController } from "./controllers/side-panel/side-panel-controller";
import { createWorkbenchTerminalController } from "./controllers/terminal/terminal-controller";
import { createCommandPaletteResourceRegistry } from "./registries/command-palette-resources/command-palette-resource-registry";
import { createCommandRegistry } from "./registries/commands/command-registry";
import { createKeybindingRegistry } from "./registries/keybindings/keybinding-registry";
import { createLayoutModel } from "./registries/layout/layout-model";
import { getActiveLocationPlacement } from "./registries/layout/layout-operations";
import { createMenuRegistry } from "./registries/menus/menu-registry";
import { createWorkbenchModeRegistry } from "./registries/modes/mode-registry";
import { createNavigationRegistry } from "./registries/navigation/navigation-registry";
import { createNotificationRegistry } from "./registries/notifications/notification-registry";
import { createPreferenceRegistry } from "./registries/preferences/preference-registry";
import { createControlsRendererRegistry } from "./registries/renderers/controls-renderer-registry";
import { createDataTableRendererRegistry } from "./registries/renderers/data-table-renderer-registry";
import { createFileRendererRegistry } from "./registries/renderers/file-renderer-registry";
import { createKanbanRendererRegistry } from "./registries/renderers/kanban-renderer-registry";
import { createWorkbenchRendererRegistry } from "./registries/renderers/renderer-registry";
import { createTreeRendererRegistry } from "./registries/renderers/tree-renderer-registry";
import { createResourceRegistry } from "./registries/resources/resource-registry";
import { createSettingsRegistry } from "./registries/settings/settings-registry";
import { createFileIconThemeRegistry } from "./registries/themes/file-icon-theme-registry";
import { createThemeRegistry } from "./registries/themes/theme-registry";
import { createContextKeyService } from "./shared/context/context-key-service";
import type { Disposable } from "./shared/disposable";
import { createDisposable } from "./shared/disposable";
import { registerWorkbenchBuiltIns } from "./workbench-built-ins";
import type { CreateWorkbenchCoreInput, WorkbenchCore } from "./workbench-core-types";
import { createModuleContext, disposeDisposables, toDisposables } from "./workbench-module-context";
import { createWorkbenchNavigationDispatcher } from "./workbench-navigation-dispatcher";

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
} from "./workbench-core-types";

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

  const core: WorkbenchCore = {
    breadcrumbs: createWorkbenchBreadcrumbController(),
    commandPalette: createWorkbenchCommandPaletteController(),
    commands,
    context,
    focus,
    host: {
      getSnapshot: () => ({ layout: layout.getLayout() }),
      restoreSnapshot: (snapshot) => layout.restoreLayout(snapshot.layout),
      setPersistenceScope: (scope, scopeInput = {}) =>
        layout.setPersistenceScope(scope, { carryRegionState: scopeInput.carryRegions }),
      getPersistenceScope: layout.getPersistenceScope,
    },
    history: undefined as unknown as WorkbenchCore["history"],
    keybindings: createKeybindingRegistry({ commands, context }),
    lastResource: createWorkbenchLastResourceController({
      persistence: input.lastResourcePersistence,
      openResource: (resource) => core.resources.openResource(resource, { replaceActive: true }),
    }),
    layout,
    modes: undefined as unknown as WorkbenchCore["modes"],
    notifications: createNotificationRegistry(),
    navigation: createNavigationRegistry({
      resolveDispatcher: () => createWorkbenchNavigationDispatcher(core),
    }),
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
    }),
    settings: createSettingsRegistry(),
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
