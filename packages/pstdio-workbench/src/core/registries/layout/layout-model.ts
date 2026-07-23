import { createWorkbenchStore } from "../../shared/store/workbench-store";
import {
  createContributionLists,
  createContributionRegistrations,
  createRegionQueries,
} from "./layout-contribution-helpers";
import type { CreateLayoutModelInput, LayoutModel, LayoutScope } from "./layout-model-types";
import {
  activateInLayout,
  closeWidgetInLayout,
  getActiveLocationPlacement,
  removePlacementsForContribution,
  setLocationSubPanelSelection,
} from "./layout-operations";
import { createLayoutPlacementMethods } from "./layout-placement-methods";
import {
  carryPinnedWorkbenchChrome,
  carryWorkbenchRegionState,
  createScopeEvent,
  resolveScopedLayout,
} from "./layout-scope";
import { withoutPreviewTabs } from "./layout-tab-lifecycle";
import {
  mergeWithDefaultRegions,
  type WorkbenchLayout,
  type WorkbenchLayoutStoreState,
  type WorkbenchPanelRegion,
  type WorkbenchRegion,
  type WorkbenchRegionState,
  type WorkbenchWidgetPlacement,
  workbenchPanelRegions,
} from "./layout-types";
import { createWidgetOpeners } from "./layout-widget-openers";
import { createPanelRegistrations } from "./panel-registration";

export type {
  CreateLayoutModelInput,
  LayoutModel,
  LayoutPersistenceAdapter,
  LayoutScope,
} from "./layout-model-types";
export type {
  OpenWidgetInput,
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
  WorkbenchPanelMenuContribution,
  WorkbenchPanelMenuDefinition,
  WorkbenchPanelMenuOwner,
  WorkbenchPanelMenuRegion,
  WorkbenchPanelMenuSide,
  WorkbenchPanelRegion,
  WorkbenchRegion,
  WorkbenchRegionSize,
  WorkbenchRegionState,
  WorkbenchSubPanelContribution,
  WorkbenchTabPosition,
  WorkbenchTabRetention,
  WorkbenchWidgetPlacement,
  WorkbenchWidgetRole,
  WorkbenchWidgetTab,
} from "./layout-types";
export {
  createDefaultWorkbenchLayout,
  getWorkbenchPanelForMenuRegion,
  workbenchPanelMenuRegions,
  workbenchPanelRegions,
  workbenchRegions,
} from "./layout-types";

export const createLayoutModel = (input: CreateLayoutModelInput = {}): LayoutModel => {
  let currentScope: LayoutScope | undefined;
  const willChangeScope = createScopeEvent<LayoutScope | undefined>();
  const didChangeScope = createScopeEvent<LayoutScope | undefined>();
  const persisted = input.persistence?.getLayout(currentScope);
  const initialLayout = resolveScopedLayout(input.defaultRegionVisibility, persisted);

  const store = createWorkbenchStore<WorkbenchLayoutStoreState>({
    name: "workbench.layout",
    initialState: { layout: initialLayout, widgets: {}, placeholders: {} },
  });

  const getLayout = () => store.getState().layout;
  const getPlaceholders = () => store.getState().placeholders;
  const getWidgets = () => store.getState().widgets;
  const getPlaceholder = (regionId: WorkbenchRegion) => getPlaceholders()[regionId];
  const regionQueries = createRegionQueries({ getLayout, getWidgets, getPlaceholder });
  const contributionLists = createContributionLists({ getPlaceholders, getWidgets });

  const persistLayout = () => input.persistence?.setLayout(withoutPreviewTabs(getLayout()), currentScope);

  const requireWidget = (id: string) => {
    const widget = getWidgets()[id];
    if (!widget) throw new Error(`Widget not registered: ${id}`);
    return widget;
  };

  const setLayout = (layout: WorkbenchLayout) => {
    const snapshot = store.getState();
    if (snapshot.layout === layout) return;
    store.setState({ ...snapshot, layout }, false, "setLayout");
  };

  const updateRegion = (regionId: WorkbenchRegion, update: (region: WorkbenchRegionState) => WorkbenchRegionState) => {
    const layout = getLayout();
    const region = layout.regions[regionId];
    const nextRegion = update(region);
    if (nextRegion === region) return;
    setLayout({ ...layout, regions: { ...layout.regions, [regionId]: nextRegion } });
    persistLayout();
  };

  const applyAndActivate = (
    layout: WorkbenchLayout,
    regionId: WorkbenchRegion,
    placement: WorkbenchWidgetPlacement,
  ) => {
    setLayout(activateInLayout(layout, regionId, placement));
    persistLayout();
    return placement;
  };

  const contributionRegistrations = createContributionRegistrations({
    store,
    getPlaceholders,
    getWidgets,
    persistLayout,
  });
  const panelRegistrations = createPanelRegistrations({
    registerWidget: contributionRegistrations.registerWidget,
  });
  const widgetOpeners = createWidgetOpeners({ getLayout, requireWidget, applyAndActivate });
  const placementMethods = createLayoutPlacementMethods({
    getLayout,
    requireWidget,
    setLayout,
    persistLayout,
    applyAndActivate,
  });

  return {
    store,

    registerPlaceholder: contributionRegistrations.registerPlaceholder,

    registerWidget: contributionRegistrations.registerWidget,

    ...panelRegistrations,

    unregisterWidget(id, options = {}) {
      const current = store.getState();
      if (!current.widgets[id]) return;
      const { [id]: _removed, ...nextWidgets } = current.widgets;
      const nextLayout =
        options.removePlacements === false ? current.layout : removePlacementsForContribution(current.layout, id);
      store.setState({ ...current, widgets: nextWidgets, layout: nextLayout }, false, "unregisterWidget");
      if (options.persist !== false) persistLayout();
    },

    getWidget(id) {
      return getWidgets()[id];
    },

    getPlaceholder,

    getRegionSize: regionQueries.getRegionSize,
    getRegionCollapsible: regionQueries.getRegionCollapsible,
    getRegionHeaderBorderBottom: regionQueries.getRegionHeaderBorderBottom,

    setRegionVisible(regionId, visible) {
      updateRegion(regionId, (region) => (region.visible === visible ? region : { ...region, visible }));
    },

    setRegionSize(regionId, size) {
      updateRegion(regionId, (region) => (region.size === size ? region : { ...region, size }));
    },

    listPlaceholders: contributionLists.listPlaceholders,
    listWidgets: contributionLists.listWidgets,
    openWidget: widgetOpeners.openWidget,

    ...placementMethods,

    setRegionActiveWidget(regionId, widgetId) {
      const layout = getLayout();
      const region = layout.regions[regionId];
      const placement = widgetId ? region.widgets.find((candidate) => candidate.widgetId === widgetId) : undefined;
      if (widgetId && !placement) throw new Error(`Widget placement not found in ${regionId}: ${widgetId}`);
      if (region.activeWidgetId === widgetId) return;

      const nextLayout = {
        ...layout,
        activeWidgetId: layout.activeWidgetId === region.activeWidgetId ? placement?.widgetId : layout.activeWidgetId,
        activeResourceUri:
          layout.activeWidgetId === region.activeWidgetId ? placement?.resourceUri : layout.activeResourceUri,
        regions: {
          ...layout.regions,
          [regionId]: { ...region, activeWidgetId: placement?.widgetId },
        },
      };
      const withSelection =
        regionId !== "side" && workbenchPanelRegions.includes(regionId as WorkbenchPanelRegion)
          ? setLocationSubPanelSelection(
              nextLayout,
              getActiveLocationPlacement(nextLayout),
              regionId as WorkbenchPanelRegion,
              placement?.role === "sub-panel" ? placement.widgetId : undefined,
            )
          : nextLayout;
      setLayout(withSelection);
      persistLayout();
    },

    closeWidget(widgetId) {
      const result = closeWidgetInLayout(getLayout(), widgetId);
      if (!result) throw new Error(`Widget placement not found: ${widgetId}`);
      if (result.closedPlacement.closable !== true) throw new Error(`Widget cannot be closed: ${widgetId}`);

      setLayout(result.layout);
      persistLayout();
      return result.activePlacement;
    },

    removeWidgetPlacement(widgetId) {
      const result = closeWidgetInLayout(getLayout(), widgetId);
      if (!result) return undefined;
      setLayout(result.layout);
      persistLayout();
      return result.activePlacement;
    },

    clearRegion(regionId) {
      const layout = getLayout();
      const region = layout.regions[regionId];
      const activeWidgetId = region.activeWidgetId;

      const cleared: WorkbenchLayout = {
        ...layout,
        regions: { ...layout.regions, [regionId]: { ...region, widgets: [], activeWidgetId: undefined } },
      };
      let next =
        activeWidgetId && layout.activeWidgetId === activeWidgetId
          ? { ...cleared, activeWidgetId: undefined, activeResourceUri: undefined }
          : cleared;

      if (regionId !== "side" && workbenchPanelRegions.includes(regionId as WorkbenchPanelRegion)) {
        next = setLocationSubPanelSelection(
          next,
          getActiveLocationPlacement(next),
          regionId as WorkbenchPanelRegion,
          undefined,
        );
      }

      setLayout(next);
      persistLayout();
    },

    resetRegions() {
      const layout = getLayout();
      const nextRegions = {} as WorkbenchLayout["regions"];
      for (const [id, region] of Object.entries(layout.regions) as [WorkbenchRegion, WorkbenchRegionState][]) {
        nextRegions[id] = { ...region, widgets: [], activeWidgetId: undefined };
      }
      setLayout({
        regions: nextRegions,
        locationSubPanelSelections: {},
        activeWidgetId: undefined,
        activeLocationWidgetId: undefined,
        activeResourceUri: undefined,
      });
      persistLayout();
    },

    getLayout,

    restoreLayout(layout) {
      setLayout(mergeWithDefaultRegions(layout, input.defaultRegionVisibility));
      persistLayout();
    },

    setPersistenceScope(nextScope, scopeInput = {}) {
      if (currentScope === nextScope) return;
      input.persistence?.setLayout(withoutPreviewTabs(getLayout()), currentScope);
      willChangeScope.notify(nextScope);
      currentScope = nextScope;
      const incoming = input.persistence?.getLayout(currentScope);
      const scopedLayout = resolveScopedLayout(input.defaultRegionVisibility, incoming);
      // Module-owned chrome is global workbench structure. Project scopes replace
      // Location workspaces, but must not unmount pinned navigation and headers.
      const withPinnedChrome = carryPinnedWorkbenchChrome(getLayout(), scopedLayout);
      const nextLayout = carryWorkbenchRegionState(getLayout(), withPinnedChrome, scopeInput.carryRegionState ?? []);
      const snapshot = store.getState();
      store.setState({ ...snapshot, layout: nextLayout }, false, "setPersistenceScope");
      didChangeScope.notify(currentScope);
    },

    getPersistenceScope: () => currentScope,

    onWillChangePersistenceScope: willChangeScope.subscribe,
    onDidChangePersistenceScope: didChangeScope.subscribe,
  };
};
