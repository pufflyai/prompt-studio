import { resourceKey, workbenchPages } from "@pstdio/sdk/extensions";
import { defaultPageResourceCodec } from "pstdio-api-contracts";
import { createWorkbenchBreadcrumbController } from "./controllers/breadcrumbs/breadcrumb-registry";
import { createWorkbenchCommandPaletteController } from "./controllers/command-palette/command-palette-controller";
import { registerArrangementCommands } from "./controllers/composition/arrangement-commands";
import { createPanelArrangement } from "./controllers/composition/panel-arrangement";
import { createPlacementCloseController } from "./controllers/composition/placement-close-controller";
import { createPlacementPinController } from "./controllers/composition/placement-pin-controller";
import { createLayoutResetController } from "./controllers/composition/reset-workbench-layout";
import { removeWorkbenchResource } from "./controllers/composition/resource-removal";
import { createWorkbenchFocusController } from "./controllers/focus/focus-controller";
import {
  connectMainFullscreen,
  createMainFullscreen,
  isFullscreenRegionFocusable,
} from "./controllers/fullscreen/main-fullscreen";
import { connectWorkbenchPageBreadcrumbs } from "./controllers/page-location/page-breadcrumbs";
import { createWorkbenchPageLocationController } from "./controllers/page-location/page-location-controller";
import {
  createMemoryWorkbenchPageLocationBrowser,
  createMemoryWorkbenchPageLocationPersistence,
} from "./controllers/page-location/page-location-memory";
import { validatePageLanding } from "./controllers/page-runtime/page-panel-view";
import { createLiveWorkbenchPageRegistry } from "./controllers/page-runtime/page-runtime";
import {
  createPageStateRestorer,
  loadWorkbenchLocationLayout,
} from "./controllers/page-runtime/page-state-restoration";
import { createCoreLayoutCache } from "./controllers/page-runtime/workbench-layout-cache-input";
import {
  connectModeLayoutCache,
  createPageLayoutCacheHandlers,
  createShellLayoutContext,
} from "./controllers/page-runtime/workbench-layout-context";
import { createWorkbenchPanelMenuStateController } from "./controllers/panel-menus/panel-menu-state-controller";
import { resourceViewerBinding } from "./controllers/resource-viewers/displayed-viewers";
import {
  createWorkbenchViewerController,
  focusPageResource,
  restorePageLocation,
} from "./controllers/resource-viewers/resource-viewers";
import { createWorkbenchShellController } from "./controllers/shell/shell-controller";
import { createModeSidePanel } from "./controllers/side-panel/mode-side-panel";
import { createWorkbenchTerminalController } from "./controllers/terminal/terminal-controller";
import { createCommandPaletteResourceRegistry } from "./registries/command-palette-resources/command-palette-resource-registry";
import { createCommandRegistry } from "./registries/commands/command-registry";
import { createKeybindingRegistry } from "./registries/keybindings/keybinding-registry";
import { createLayoutModel } from "./registries/layout/layout-model";
import type { LayoutPersistenceAdapter } from "./registries/layout/layout-model-types";
import { createMenuRegistry } from "./registries/menus/menu-registry";
import { createWorkbenchModePlacementRegistry } from "./registries/modes/mode-placement-registry";
import { createWorkbenchModeRegistry } from "./registries/modes/mode-registry";
import type { createNavigationTreeRegistry } from "./registries/navigation/navigation-tree-registry";
import { actionErrorTarget } from "./registries/notifications/action-error-target";
import { createNotificationRegistry } from "./registries/notifications/notification-registry";
import { createWorkbenchOverlayRegistry } from "./registries/overlays/overlay-registry";
import { pageContentOwners } from "./registries/pages/page-content";
import { createWorkbenchPlaceholderRegistry } from "./registries/placeholders/placeholder-registry";
import { createWorkbenchShellPlacementRegistry } from "./registries/placements/shell-placement-registry";
import { createPreferenceRegistry } from "./registries/preferences/preference-registry";
import { createResourceRegistry } from "./registries/resources/resource-registry";
import { createSettingsRegistry } from "./registries/settings/settings-registry";
import { createStatusRegistry } from "./registries/statuses/status-registry";
import { createFileIconThemeRegistry } from "./registries/themes/file-icon-theme-registry";
import { createThemeRegistry } from "./registries/themes/theme-registry";
import { createContextKeyService } from "./shared/context/context-key-service";
import { createDisposable } from "./shared/disposable";
import {
  activeWorkbenchResource,
  connectWorkbenchCoreState,
  createCoreCompositionController,
  primaryWorkbenchResource,
  subscribeActiveWorkbenchResource,
} from "./workbench-core-connections";
import { createCoreNavigationRegistry, revealPanelRegion } from "./workbench-core-navigation";
import { createWorkbenchNavigationTrees } from "./workbench-core-navigation-trees";
import { createCoreRenderers } from "./workbench-core-renderers";
import type { createWorkbenchInput, WorkbenchCore } from "./workbench-core-types";
import { createCoreViews } from "./workbench-core-views";
import { createWorkbenchModuleRegistry } from "./workbench-module-registry";
import { createPagePersistenceScopeHandler } from "./workbench-page-persistence";
import { setWorkbenchRenderers } from "./workbench-renderers";

export * from "./workbench-core-types";

const createPageLocations = (
  input: createWorkbenchInput,
  registry: ReturnType<typeof createLiveWorkbenchPageRegistry>,
  navigationTrees: ReturnType<typeof createNavigationTreeRegistry>,
  modes: ReturnType<typeof createWorkbenchModeRegistry>,
  resolveCore: () => WorkbenchCore,
) =>
  createWorkbenchPageLocationController({
    registry,
    browser: input.pageLocationBrowser ?? createMemoryWorkbenchPageLocationBrowser(),
    navigationTrees,
    modes,
    persistence: input.pageLocationPersistence ?? createMemoryWorkbenchPageLocationPersistence(),
    startPage: input.startPage ?? workbenchPages.start,
    getResourceRemovalVersion: () => resolveCore().resources.getRemovalVersion(),
    getResourceRemovalEpoch: () => resolveCore().resources.getRemovalEpoch(),
    restoreLocation: (location, projectId, removalVersion) =>
      restorePageLocation(resolveCore(), location, projectId, removalVersion),
    focusResource: (location, open) => focusPageResource(resolveCore(), location, open),
    activateLocation: () => {
      const core = resolveCore();
      if (core.pages.getContent()) core.focus.setActiveRegion("main");
    },
  });

const disposeLayoutPersistence = (persistence: LayoutPersistenceAdapter | undefined) => {
  // Save pending writes before the adapter releases its resources.
  persistence?.flush?.();
  persistence?.dispose?.();
};

import { layoutPanelGuards } from "./controllers/shell/layout-panel-policy";
import { requirePanelOpen } from "./controllers/shell/panel-open-policy";
import { restorePanelPolicy, workbenchPanelPolicy } from "./controllers/shell/workbench-panel-policy";
import { createWorkbenchHost } from "./workbench-core-host";

export const createWorkbench = (input: createWorkbenchInput = {}) => {
  let core: WorkbenchCore;
  const context = createContextKeyService();
  const commands = createCommandRegistry({ context, getProjectId: () => core?.pages.store.getState().projectId });
  const renderers = createCoreRenderers(input);

  const layoutCache = createCoreLayoutCache(input, () => core);
  const cachedInput = { ...input, persistence: undefined, layoutPersistence: layoutCache.layout };
  const locationAwareLayout = createLayoutModel({
    defaultRegionVisibility: {
      ...input.defaultPanelOpenByRegionId,
      side: (input.initialSidePanelMode ?? "floating") !== "closed",
    },
    // The active mode owns region policy; the host input is the fallback. Resolved
    // lazily because the mode registry is created after the layout model.
    getRegionSettings: (regionId, activeModeId = core?.modes.getActiveModeId()) => {
      const activeMode = activeModeId ? core?.modes.getMode(activeModeId) : undefined;
      return { ...input.regionSettings?.[regionId], ...activeMode?.regionSettings?.[regionId] };
    },
    ...layoutPanelGuards(() => core),
    normalizeLayout: (layout) => restorePanelPolicy(core, layout),
    getDetachedOwners: () => (core ? pageContentOwners(core.pages) : []),
    persistence: layoutCache.layout,
  });

  const { establishLocation, ...layoutModel } = locationAwareLayout;

  const layout = {
    ...layoutModel,
    ...createMenuRegistry({ commands }),
  };

  const focus = createWorkbenchFocusController({
    context,
    isRegionFocusable: (region) =>
      isFullscreenRegionFocusable(core, region) ?? layout.getLayout().regions[region].visible,
  });

  const { views, viewMenus, statusBar } = createCoreViews(input, renderers);
  const pageResources = input.pageResources ?? defaultPageResourceCodec;

  const modePlacements = createWorkbenchModePlacementRegistry({
    resourceReferenceKey: (resource) => core?.pages.resourceReferenceKey(resource) ?? resourceKey(resource),
    loadLayout: (context) => layoutCache.readMode(context.projectId, context.modeId),
    validateOpen: (identity, region, options) => requirePanelOpen(core, region, { identity, ...options }),
    getProjectId: () => core?.pages.store.getState().projectId,
    views,
    viewMenus,
    getPanel: layout.getWidget,
    registerPanel: layout,
  });

  const shellPlacements = createWorkbenchShellPlacementRegistry({
    resourceReferenceKey: (resource) => core?.pages.resourceReferenceKey(resource) ?? resourceKey(resource),
    views,
    viewMenus,
    getPanel: layout.getWidget,
    registerPanel: layout,
    activatePanel: layout.activatePanel,
    getLayout: layout.getLayout,
    getScope: layout.getPersistenceScope,
    ...createShellLayoutContext(() => core),
    validateOpen: (identity, region, options) => requirePanelOpen(core, region, { identity, ...options }),
    resolveScope: input.resolvePagePersistenceScope
      ? (context) =>
          input.resolvePagePersistenceScope!({
            ...context,
            currentScope: layout.getPersistenceScope(),
            resource: context.location?.resource,
          }).scope
      : undefined,
    loadLayout: (context) =>
      layoutCache.readMode(context.projectId, context.modeId) ??
      loadWorkbenchLocationLayout(cachedInput, { ...context, resource: context.location?.resource }, layout),
    enteredWithPersistedLayout: layout.enteredWithPersistedLayout,
    onDidChangePersistenceScope: layout.onDidChangePersistenceScope,
  });

  const navigationTrees = createWorkbenchNavigationTrees(renderers);

  const overlays = createWorkbenchOverlayRegistry({ layout, views, viewMenus });
  const placeholders = createWorkbenchPlaceholderRegistry({ layout, views });
  const breadcrumbs = createWorkbenchBreadcrumbController();
  const panelMenuState = createWorkbenchPanelMenuStateController({
    persistence: input.panelMenuStatePersistence,
  });

  const resources = createResourceRegistry({
    remove: (resource, retained) => removeWorkbenchResource(core, resource, retained, layoutCache.removeResource),
    getPrimary: () => core.getPrimaryResource(),
    resolveView: views.getView,
  });

  const modes = createWorkbenchModeRegistry({
    establishLocation,
    layout,
    resolveContext: () => core,
  });

  const sidePanel = createModeSidePanel(layout, modes, input, () => core);
  const shell = createWorkbenchShellController({
    layout,
    sidePanel,
    getPolicy: (region) => workbenchPanelPolicy(core, region),
  });

  const pages = createLiveWorkbenchPageRegistry({
    isResourceViewer: (identity) => Boolean(core && resourceViewerBinding(core, identity)?.kind === "binding"),
    ...createPageLayoutCacheHandlers(layoutCache),
    loadModeLayout: layoutCache.readMode,
    saveModeLayout: layoutCache.saveMode,
    beforeApply: createPagePersistenceScopeHandler(input, layout, panelMenuState),
    restorePageState: createPageStateRestorer(cachedInput, layoutCache.loadPageLayout, layoutCache.hasPageMain),
    validateLanding: (state, identity) => validatePageLanding(core, state, identity),

    revealRegion: (region) => revealPanelRegion(core, region),
    layout,
    modePlacements,
    modes,
    shellPlacements,
    views,
    viewMenus,
    resources: pageResources,
  });

  const pageLocations = createPageLocations(input, pages, navigationTrees, modes, () => core);

  const composition = createCoreCompositionController(() => core);
  const viewers = createWorkbenchViewerController(() => core);

  core = {
    viewers: viewers.controller,
    getOpenResources: () => {
      const resources = layoutCache.listResources(layout.getLayout());
      const resource = pages.getContent()?.resource;
      return resource
        ? [...resources.filter((entry) => resourceKey(entry) !== resourceKey(resource)), resource]
        : resources;
    },
    closePlacement: createPlacementCloseController(() => core),
    pinPlacement: createPlacementPinController(() => core),
    ...createPanelArrangement(() => core),
    ...createLayoutResetController(() => core),
    breadcrumbs,
    commandPalette: createWorkbenchCommandPaletteController(),
    commands,
    composition,
    context,
    focus,
    fullscreen: createMainFullscreen(() => core),
    host: createWorkbenchHost(layout, layoutCache, pages.getContent),
    keybindings: createKeybindingRegistry({ commands, context }),
    layout,
    modes,
    modePlacements,
    shellPlacements,
    notifications: createNotificationRegistry(() => actionErrorTarget({ focus, layout })),
    overlays,
    placeholders,
    pageLocations,
    pages,
    navigation: createCoreNavigationRegistry(() => core),
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

    async dispose() {
      viewers.dispose();
      disposeFullscreen();
      disposeLayoutPersistence(layoutCache.layout);
      await Promise.all([views.reads.dispose(), core.terminal.dispose()]);
    },

    onDidChangeActiveResource(listener) {
      return subscribeActiveWorkbenchResource(core, listener);
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
  const disposeFullscreen = connectMainFullscreen(core);
  registerArrangementCommands(core);
  connectModeLayoutCache(core, layoutCache);
  const breadcrumbSources = { breadcrumbs, locations: pageLocations, pages, navigationTrees, modes };
  connectWorkbenchPageBreadcrumbs({ ...breadcrumbSources, layout, resources: pageResources });
  connectWorkbenchCoreState(core, input);

  return core;
};
