import { createWorkbenchStore } from "../../shared/store/workbench-store";
import {
  createContributionLists,
  createContributionRegistrations,
  createRegionQueries,
} from "./layout-contribution-helpers";
import type { CreateLayoutModelInput, LayoutModel } from "./layout-model-types";
import {
  activateInLayout,
  closeWidgetInLayout,
  findPlacementByWidgetId,
  getActiveLocationPlacement,
  removePlacementsForContribution,
  selectRegionActiveWidget,
  setLocationSubPanelSelection,
} from "./layout-operations";
import { createLayoutPlacementMethods } from "./layout-placement-methods";
import { resolveScopedLayout } from "./layout-scope";
import { createLayoutScopeMethods } from "./layout-scope-methods";
import {
  mergeWithDefaultRegions,
  type RegisteredWidgetContribution,
  type WorkbenchLayout,
  type WorkbenchLayoutStoreState,
  type WorkbenchPanelInstance,
  type WorkbenchPanelRegion,
  type WorkbenchRegion,
  type WorkbenchRegionState,
  type WorkbenchWidgetPlacement,
  workbenchPanelRegions,
} from "./layout-types";
import { createWidgetOpeners } from "./layout-widget-openers";
import { createPanelLayoutMethods } from "./panel-layout-methods";
import { createOwnedMenuMethods } from "./panel-menu-ownership";
import { createPanelRegistrations } from "./panel-registration";

export type {
  CreateLayoutModelInput,
  LayoutModel,
  LayoutPersistenceAdapter,
  LayoutScope,
} from "./layout-model-types";
export type {
  OpenWidgetInput,
  OpenWorkbenchPanelInput,
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
  WorkbenchPanelContribution,
  WorkbenchPanelInstance,
  WorkbenchPanelMenuContribution,
  WorkbenchPanelMenuDefinition,
  WorkbenchPanelMenuOwner,
  WorkbenchPanelMenuRegion,
  WorkbenchPanelMenuSide,
  WorkbenchPanelMountStrategy,
  WorkbenchPanelOpenStrategy,
  WorkbenchPanelRegion,
  WorkbenchPanelReusePolicy,
  WorkbenchPanelTab,
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

interface LocationAwareLayoutModel extends LayoutModel {
  establishLocation(instanceId: string): WorkbenchPanelInstance;
}

interface CreateLocationEstablisherInput {
  applyAndActivate(
    layout: WorkbenchLayout,
    regionId: WorkbenchRegion,
    placement: WorkbenchWidgetPlacement,
  ): WorkbenchWidgetPlacement;
  getLayout(): WorkbenchLayout;
  getWidget(id: string): RegisteredWidgetContribution | undefined;
  panelMethods: Pick<LayoutModel, "activatePanel" | "getActivePanel">;
}

const createLocationEstablisher = (input: CreateLocationEstablisherInput) => (instanceId: string) => {
  const layout = input.getLayout();
  const found = findPlacementByWidgetId(layout, instanceId);
  if (!found) throw new Error(`Panel instance not found: ${instanceId}`);
  // Sub Panels and Panel Menus stay tabs beside their Location: promoting one would
  // create a second Location and clone every Sub Panel per Location.
  if (found.regionId !== "main" || found.placement.role === "sub-panel" || found.placement.role === "panel-menu") {
    return input.panelMethods.activatePanel(instanceId);
  }

  const placement = { ...found.placement, role: "location" as const };
  const ownedPanelMenuIds = new Set(input.getWidget(placement.contributionId)?.ownedPanelMenuIds ?? []);
  const regions = Object.fromEntries(
    Object.entries(layout.regions).map(([regionId, region]) => [
      regionId,
      {
        ...region,
        widgets: region.widgets.map((candidate) => {
          if (candidate.widgetId === instanceId) return placement;
          if (!ownedPanelMenuIds.has(candidate.contributionId)) return candidate;
          if (candidate.resourceUri !== placement.resourceUri) return candidate;
          return { ...candidate, ownerResourceUri: placement.resourceUri };
        }),
      },
    ]),
  ) as WorkbenchLayout["regions"];
  input.applyAndActivate(
    {
      ...layout,
      regions,
    },
    "main",
    placement,
  );
  // A sub-panels-only Location presents no content of its own: hand the active
  // slot to its first Sub Panel as soon as one exists.
  if (input.getWidget(placement.contributionId)?.subPanelsOnly) {
    const subPanel = input
      .getLayout()
      .regions.main.widgets.find(
        (candidate) =>
          candidate.role === "sub-panel" &&
          (!candidate.ownerResourceUri || candidate.ownerResourceUri === placement.resourceUri),
      );
    if (subPanel) return input.panelMethods.activatePanel(subPanel.widgetId);
  }
  return input.panelMethods.getActivePanel("main")!;
};

const requireRegisteredWidget = (
  widgets: WorkbenchLayoutStoreState["widgets"],
  id: string,
): RegisteredWidgetContribution => {
  const widget = widgets[id];
  if (!widget) throw new Error(`Widget not registered: ${id}`);
  return widget;
};

export const createLayoutModel = (input: CreateLayoutModelInput = {}): LocationAwareLayoutModel => {
  const persisted = input.persistence?.getLayout(undefined);
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

  const scopeMethods = createLayoutScopeMethods({
    defaultRegionVisibility: input.defaultRegionVisibility,
    getLayout,
    persistence: input.persistence,
    setLayout: (layout, action) => store.setState({ ...store.getState(), layout }, false, action),
  });
  const persistLayout = () => scopeMethods.persistLayout();

  const requireWidget = (id: string) => requireRegisteredWidget(getWidgets(), id);

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
  const panelMethods = createPanelLayoutMethods({
    getLayout,
    getWidgets,
    listWidgets: contributionLists.listWidgets,
    persistLayout,
    placementMethods,
    setLayout,
    widgetOpeners,
  });
  const ownedMenus = createOwnedMenuMethods({
    getLayout,
    getWidget: (id) => getWidgets()[id],
    openWidget: widgetOpeners.openWidget,
    persistLayout,
    setLayout,
  });

  const establishLocation = createLocationEstablisher({
    applyAndActivate,
    getLayout,
    getWidget: requireWidget,
    panelMethods,
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
    ...panelMethods,
    openWidget: ownedMenus.openWidget,

    ...placementMethods,

    establishLocation,

    reconcilePanelMenus: ownedMenus.reconcilePanelMenus,

    setRegionActiveWidget(regionId, widgetId) {
      const nextLayout = selectRegionActiveWidget(getLayout(), regionId, widgetId);
      if (!nextLayout) return;
      setLayout(nextLayout);
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

    setPersistenceScope: scopeMethods.setPersistenceScope,
    getPersistenceScope: scopeMethods.getPersistenceScope,
    hasPersistedLayout: scopeMethods.hasPersistedLayout,
    enteredWithPersistedLayout: scopeMethods.enteredWithPersistedLayout,
    onWillChangePersistenceScope: scopeMethods.onWillChangePersistenceScope,
    onDidChangePersistenceScope: scopeMethods.onDidChangePersistenceScope,
  };
};
