import { workbenchPages } from "@pstdio/sdk/extensions";
import { createWorkbenchBreadcrumbController } from "./controllers/breadcrumbs/breadcrumb-registry";
import { createWorkbenchCommandPaletteController } from "./controllers/command-palette/command-palette-controller";
import { createPlacementCloseController } from "./controllers/composition/placement-close-controller";
import { createPlacementPinController } from "./controllers/composition/placement-pin-controller";
import { createWorkbenchFocusController } from "./controllers/focus/focus-controller";
import { connectWorkbenchPageBreadcrumbs } from "./controllers/page-location/page-breadcrumbs";
import { createWorkbenchPageLocationController } from "./controllers/page-location/page-location-controller";
import {
  createMemoryWorkbenchPageLocationBrowser,
  createMemoryWorkbenchPageLocationPersistence,
} from "./controllers/page-location/page-location-memory";
import { defaultPageResourceCodec } from "./controllers/page-location/page-resource-codec";
import { createLiveWorkbenchPageRegistry } from "./controllers/page-runtime/page-runtime";
import {
  createPageStateRestorer,
  loadWorkbenchLocationLayout,
} from "./controllers/page-runtime/page-state-restoration";
import { createWorkbenchLayoutCache } from "./controllers/page-runtime/workbench-layout-cache";
import { createWorkbenchPanelMenuStateController } from "./controllers/panel-menus/panel-menu-state-controller";
import { createWorkbenchShellController } from "./controllers/shell/shell-controller";
import { createWorkbenchSidePanelController } from "./controllers/side-panel/side-panel-controller";
import { createWorkbenchTerminalController } from "./controllers/terminal/terminal-controller";
import { createCommandPaletteResourceRegistry } from "./registries/command-palette-resources/command-palette-resource-registry";
import { createCommandRegistry } from "./registries/commands/command-registry";
import { createKeybindingRegistry } from "./registries/keybindings/keybinding-registry";
import { createLayoutModel } from "./registries/layout/layout-model";
import type { WorkbenchWidgetPlacement } from "./registries/layout/layout-types";
import { createMenuRegistry } from "./registries/menus/menu-registry";
import { createWorkbenchModePlacementRegistry } from "./registries/modes/mode-placement-registry";
import { createWorkbenchModeRegistry } from "./registries/modes/mode-registry";
import { createNavigationTreeRegistry } from "./registries/navigation/navigation-tree-registry";
import { createNotificationRegistry } from "./registries/notifications/notification-registry";
import { createWorkbenchOverlayRegistry } from "./registries/overlays/overlay-registry";
import type { WorkbenchPageRegistryStoreState } from "./registries/pages/page-registry";
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
import { createWorkbenchModuleRegistry } from "./workbench-module-registry";
import { setWorkbenchRenderers } from "./workbench-renderers";

export * from "./workbench-core-types";

const createPagePersistenceScopeHandler = (
  input: createWorkbenchInput,
  layout: Pick<ReturnType<typeof createLayoutModel>, "getPersistenceScope" | "setPersistenceScope">,
  panelMenuState: ReturnType<typeof createWorkbenchPanelMenuStateController>,
) => {
  const resolveScope = input.resolvePagePersistenceScope;
  if (!resolveScope) return undefined;
  return (state: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>) => {
    const resolved = resolveScope({
      currentScope: layout.getPersistenceScope(),
      modeId: state.activeModeId,
      pageId: state.activePageId,
      projectId: state.projectId,
      resource: state.location?.resource,
    });
    panelMenuState.setPersistenceScope(resolved.scope);
    layout.setPersistenceScope(resolved.scope, { carryRegionState: resolved.carryRegions });
  };
};

export const createWorkbench = (input: createWorkbenchInput = {}) => {
  const context = createContextKeyService();
  const commands = createCommandRegistry({ context });
  const renderers = createCoreRenderers(input);

  const layoutCache = createWorkbenchLayoutCache(input);
  const locationAwareLayout = createLayoutModel({
    defaultRegionVisibility: input.defaultPanelOpenByRegionId,
    // The active mode owns region policy; the host input is the fallback. Resolved
    // lazily because the mode registry is created after the layout model.
    getRegionSettings: (regionId) => {
      const activeModeId = core?.modes.getActiveModeId();
      const activeMode = activeModeId ? core?.modes.getMode(activeModeId) : undefined;
      return { ...input.regionSettings?.[regionId], ...activeMode?.regionSettings?.[regionId] };
    },
    persistence: layoutCache.layout,
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
    loadLayout: (context) => layoutCache.readMode(context.projectId, context.modeId),
    getProjectId: () => core?.pages.store.getState().projectId,
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
    getScope: layout.getPersistenceScope,
    resolveScope: input.resolvePagePersistenceScope
      ? (context) =>
          input.resolvePagePersistenceScope!({
            ...context,
            currentScope: layout.getPersistenceScope(),
            resource: context.location?.resource,
          }).scope
      : undefined,
    loadLayout: (context) => loadWorkbenchLocationLayout(input, { ...context, resource: context.location?.resource }),
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
    getPrimary: () => core.getPrimaryResource(),
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
    beforeApply: createPagePersistenceScopeHandler(input, layout, panelMenuState),
    restorePageState: createPageStateRestorer(input),

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
  const navigation = createCoreNavigationRegistry(() => core);

  core = {
    closePlacement: createPlacementCloseController(() => core),
    pinPlacement: createPlacementPinController(() => core),
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
          (state) => state.layout.activeResourceKey,
          () => listener(core.getActiveResource()),
        ),
      );
    },

    getPrimaryResource() {
      return primaryWorkbenchResource(core);
    },

    onDidChangePrimaryResource(listener) {
      return createDisposable(
        core.pages.store.subscribeSelector(
          (state) => state.location?.resource,
          () => listener(core.getPrimaryResource()),
        ),
      );
    },

    registerChildModule(module) {
      return core.registerModule(module);
    },

    ...createWorkbenchModuleRegistry(() => core),
  };

  setWorkbenchRenderers(core, renderers);
  layout.store.subscribe(() => {
    const state = pages.store.getState();
    if (state.activeModeId) layoutCache.saveMode(state.projectId, state.activeModeId, layout.getLayout());
  });
  connectWorkbenchPageBreadcrumbs({ breadcrumbs, locations: pageLocations, pages, resources: pageResources });
  connectWorkbenchCoreState(core, input);

  return core;
};
