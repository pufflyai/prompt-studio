import { workbenchPages } from "@pstdio/sdk/extensions";
import { createWorkbenchBreadcrumbController } from "./controllers/breadcrumbs/breadcrumb-registry";
import { createWorkbenchCommandPaletteController } from "./controllers/command-palette/command-palette-controller";
import { createWorkbenchFocusController } from "./controllers/focus/focus-controller";
import { connectWorkbenchPageBreadcrumbs } from "./controllers/page-location/page-breadcrumbs";
import { createWorkbenchPageLocationController } from "./controllers/page-location/page-location-controller";
import {
  createMemoryWorkbenchPageLocationBrowser,
  createMemoryWorkbenchPageLocationPersistence,
} from "./controllers/page-location/page-location-memory";
import {
  createLiveWorkbenchPageRegistry,
  defaultPageResourceCodec,
  toWorkbenchPageResource,
} from "./controllers/page-runtime/page-runtime";
import { createWorkbenchPanelMenuStateController } from "./controllers/panel-menus/panel-menu-state-controller";
import { createWorkbenchShellController } from "./controllers/shell/shell-controller";
import { createWorkbenchSidePanelController } from "./controllers/side-panel/side-panel-controller";
import { createWorkbenchTerminalController } from "./controllers/terminal/terminal-controller";
import { createCommandPaletteResourceRegistry } from "./registries/command-palette-resources/command-palette-resource-registry";
import { createCommandRegistry } from "./registries/commands/command-registry";
import { createKeybindingRegistry } from "./registries/keybindings/keybinding-registry";
import { createLayoutModel } from "./registries/layout/layout-model";
import { getActiveLocationPlacement } from "./registries/layout/layout-operations";
import type { WorkbenchWidgetPlacement } from "./registries/layout/layout-types";
import { createMenuRegistry } from "./registries/menus/menu-registry";
import { createWorkbenchModePlacementRegistry } from "./registries/modes/mode-placement-registry";
import { createWorkbenchModeRegistry } from "./registries/modes/mode-registry";
import { createNavigationTreeRegistry } from "./registries/navigation/navigation-tree-registry";
import { createNotificationRegistry } from "./registries/notifications/notification-registry";
import { createWorkbenchOverlayRegistry } from "./registries/overlays/overlay-registry";
import type { WorkbenchPageRegistryStoreState, WorkbenchPageResourceCodec } from "./registries/pages/page-registry";
import { createWorkbenchPlaceholderRegistry } from "./registries/placeholders/placeholder-registry";
import { createWorkbenchShellPlacementRegistry } from "./registries/placements/shell-placement-registry";
import { createPreferenceRegistry } from "./registries/preferences/preference-registry";
import { createResourceRegistry } from "./registries/resources/resource-registry";
import { createSettingsRegistry } from "./registries/settings/settings-registry";
import { createStatusBarRegistry } from "./registries/status-bar/status-bar-registry";
import { createStatusRegistry } from "./registries/statuses/status-registry";
import { createFileIconThemeRegistry } from "./registries/themes/file-icon-theme-registry";
import { createThemeRegistry } from "./registries/themes/theme-registry";
import { createWorkbenchViewMenuRegistry } from "./registries/view-menus/view-menu-registry";
import { createWorkbenchViewBodyRegistration } from "./registries/views/view-body-registration";
import { createViewRegistry } from "./registries/views/view-registry";
import { createContextKeyService } from "./shared/context/context-key-service";
import type { Disposable } from "./shared/disposable";
import { createDisposable } from "./shared/disposable";
import {
  activeWorkbenchResource,
  connectWorkbenchCoreState,
  createCoreCompositionController,
  primaryWorkbenchResource,
} from "./workbench-core-connections";
import { createCoreNavigationRegistry, revealPanelRegion } from "./workbench-core-navigation";
import { createCoreRenderers } from "./workbench-core-renderers";
import type { createWorkbenchInput, WorkbenchCore } from "./workbench-core-types";
import { createModuleContext, disposeDisposables, toDisposables } from "./workbench-module-context";
import { setWorkbenchRenderers } from "./workbench-renderers";

export * from "./workbench-core-types";

const createPagePersistenceScopeHandler = (
  input: createWorkbenchInput,
  layout: Pick<ReturnType<typeof createLayoutModel>, "getPersistenceScope" | "setPersistenceScope">,
  panelMenuState: ReturnType<typeof createWorkbenchPanelMenuStateController>,
  pageResources: WorkbenchPageResourceCodec,
) => {
  const resolveScope = input.resolvePagePersistenceScope;
  if (!resolveScope) return undefined;
  return (state: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>) => {
    const resolved = resolveScope({
      currentScope: layout.getPersistenceScope(),
      modeId: state.activeModeId,
      pageId: state.activePageId,
      projectId: state.projectId,
      resource: state.location?.resource ? toWorkbenchPageResource(state.location.resource, pageResources) : undefined,
    });
    panelMenuState.setPersistenceScope(resolved.scope);
    layout.setPersistenceScope(resolved.scope, { carryRegionState: resolved.carryRegions });
  };
};

export const createWorkbench = (input: createWorkbenchInput = {}) => {
  const context = createContextKeyService();
  const commands = createCommandRegistry({ context });
  const moduleRecords = new Map<string, { disposable: Disposable }>();
  const renderers = createCoreRenderers(input);

  const locationAwareLayout = createLayoutModel({
    defaultRegionVisibility: input.defaultPanelOpenByRegionId,
    // The active mode owns region policy; the host input is the fallback. Resolved
    // lazily because the mode registry is created after the layout model.
    getRegionSettings: (regionId) => {
      const activeModeId = core?.modes.getActiveModeId();
      const activeMode = activeModeId ? core?.modes.getMode(activeModeId) : undefined;
      return { ...input.regionSettings?.[regionId], ...activeMode?.regionSettings?.[regionId] };
    },
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

  const views = createViewRegistry({ registerBody: createWorkbenchViewBodyRegistration(renderers) });
  const viewMenus = createWorkbenchViewMenuRegistry({ views });
  const pageResources = input.pageResources ?? defaultPageResourceCodec;

  const modePlacements = createWorkbenchModePlacementRegistry({
    views,
    viewMenus,
    getPanel: layout.getWidget,
    registerPanel: layout,
  });

  const shellPlacements = createWorkbenchShellPlacementRegistry({
    views,
    viewMenus,
    getPanel: layout.getWidget,
    registerPanel: layout,
    activatePanel: layout.activatePanel,
    getLayout: layout.getLayout,
    enteredWithPersistedLayout: layout.enteredWithPersistedLayout,
    onDidChangePersistenceScope: layout.onDidChangePersistenceScope,
  });

  const statusBar = createStatusBarRegistry({ hasView: (viewId) => Boolean(views.getView(viewId)) });

  const navigationTrees = createNavigationTreeRegistry({
    subscribeViewRefresh: (viewId, listener) =>
      renderers.onDidRefresh(({ treeId }) => {
        if (treeId === viewId) listener();
      }),
    getViewDefaultExpandedSectionIds: (viewId) => renderers.getTreeRenderer(viewId)?.defaultExpandedSectionIds,
    getViewSections: (viewId, context) => renderers.getBody(viewId, { ...context, viewId }),
    getViewChildren: (viewId, node, context) => renderers.getChildren(viewId, node, { ...context, viewId }),
  });

  const overlays = createWorkbenchOverlayRegistry({ layout, views, viewMenus });
  const placeholders = createWorkbenchPlaceholderRegistry({ layout, views });
  const breadcrumbs = createWorkbenchBreadcrumbController();
  const panelMenuState = createWorkbenchPanelMenuStateController({
    persistence: input.panelMenuStatePersistence,
  });

  const resources = createResourceRegistry({
    getPrimary: () => getActiveLocationPlacement(layout.getLayout())?.resource,
    resolveView: views.getView,
  });

  let core: WorkbenchCore;

  const modes = createWorkbenchModeRegistry({
    establishLocation,
    layout,
    resolveContext: () => core,
  });

  const sidePanel = createWorkbenchSidePanelController({
    getFloatingPanels: () => {
      const activeModeId = modes.getActiveModeId();
      return (
        (activeModeId ? modes.getMode(activeModeId)?.floatingPanels : undefined) ?? input.floatingPanels ?? "visible"
      );
    },
    onDidChangePolicy: modes.onDidChangeActive,
    initialMode: input.initialSidePanelMode,
    persistence: input.sidePanelPersistence,
  });
  const shell = createWorkbenchShellController({ layout, sidePanel });

  const pages = createLiveWorkbenchPageRegistry({
    beforeApply: createPagePersistenceScopeHandler(input, layout, panelMenuState, pageResources),
    revealRegion: (region) => revealPanelRegion(core, region),
    layout,
    modePlacements,
    modes,
    shellPlacements,
    views,
    viewMenus,
    resources: pageResources,
  });

  const pageLocations = createWorkbenchPageLocationController({
    registry: pages,
    browser: input.pageLocationBrowser ?? createMemoryWorkbenchPageLocationBrowser(),
    persistence: input.pageLocationPersistence ?? createMemoryWorkbenchPageLocationPersistence(),
    startPage: input.startPage ?? workbenchPages.start,
  });

  const composition = createCoreCompositionController(() => core);
  const navigation = createCoreNavigationRegistry(() => core, pageResources);

  core = {
    breadcrumbs,
    commandPalette: createWorkbenchCommandPaletteController(),
    commands,
    composition,
    context,
    focus,
    host: {
      getSnapshot: () => ({ layout: layout.getLayout() }),
      restoreSnapshot: (snapshot) => layout.restoreLayout(snapshot.layout),
      setPersistenceScope: (scope, scopeInput = {}) =>
        layout.setPersistenceScope(scope, { carryRegionState: scopeInput.carryRegions }),
      getPersistenceScope: layout.getPersistenceScope,
    },
    keybindings: createKeybindingRegistry({ commands, context }),
    layout,
    modes,
    modePlacements,
    shellPlacements,
    notifications: createNotificationRegistry(),
    overlays,
    placeholders,
    pageLocations,
    pages,
    navigation,
    navigationTrees,
    panelMenuState,
    preferences: createPreferenceRegistry({ persistence: input.preferencePersistence }),
    treeViews: {
      getTreeState: renderers.getTreeState,
      setNodeExpanded: renderers.setNodeExpanded,
      setSectionExpanded: renderers.setSectionExpanded,
      setSelectedNode: renderers.setSelectedNode,
    },
    commandPaletteResources: createCommandPaletteResourceRegistry(),
    resources,
    views,
    viewMenus,
    settings: createSettingsRegistry({ hasView: (viewId) => Boolean(views.getView(viewId)) }),
    statusBar,
    statuses: createStatusRegistry(),
    shell,
    sidePanel,
    terminal: createWorkbenchTerminalController(),
    themes: createThemeRegistry(),
    fileIconThemes: createFileIconThemeRegistry(),

    getActiveResource() {
      return activeWorkbenchResource(core);
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
      return primaryWorkbenchResource(core);
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
      let registration: Disposable;

      registration = createDisposable(() => {
        if (moduleRecords.get(module.id)?.disposable !== registration) return;
        moduleRecords.delete(module.id);
        disposeDisposables(disposables);
      });

      const record = { disposable: registration };

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

  setWorkbenchRenderers(core, renderers);
  connectWorkbenchPageBreadcrumbs({ breadcrumbs, locations: pageLocations, pages, resources: pageResources });
  connectWorkbenchCoreState(core, input);

  return core;
};
