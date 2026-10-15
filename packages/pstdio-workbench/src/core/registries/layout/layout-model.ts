import { createWorkbenchStore } from "../../shared/store/workbench-store";
import {
  createContributionLists,
  createContributionRegistrations,
  createRegionQueries,
} from "./layout-contribution-helpers";
import { createLocationEstablisher } from "./layout-location-establisher";
import type { CreateLayoutModelInput, LayoutModel } from "./layout-model-types";
import { activateInLayout, removePlacementsForContribution } from "./layout-operations";
import { createLayoutPlacementMethods } from "./layout-placement-methods";
import { createLayoutRegionContentMethods } from "./layout-region-content-methods";
import { createLayoutRegionMethods } from "./layout-region-methods";
import { resolveScopedLayout } from "./layout-scope";
import { createLayoutScopeMethods } from "./layout-scope-methods";
import type {
  RegisteredWidgetContribution,
  WorkbenchLayout,
  WorkbenchLayoutStoreState,
  WorkbenchPanelInstance,
  WorkbenchRegion,
  WorkbenchWidgetPlacement,
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
  WorkbenchCommandTarget,
  WorkbenchLayout,
  WorkbenchLayoutStoreState,
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
  WorkbenchRegionSettings,
  WorkbenchRegionSize,
  WorkbenchRegionState,
  WorkbenchSidePanelMode,
  WorkbenchTabAction,
  WorkbenchTabMenuGroup,
  WorkbenchTabMenuRow,
  WorkbenchTabPosition,
  WorkbenchTabRetention,
  WorkbenchTabSnapshot,
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
  const regionQueries = createRegionQueries({
    getLayout,
    getWidgets,
    getPlaceholder,
    getRegionSettings: input.getRegionSettings,
  });
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

  const regionMethods = createLayoutRegionMethods({ getLayout, setLayout, persistLayout });
  const regionContentMethods = createLayoutRegionContentMethods({
    defaultRegionVisibility: input.defaultRegionVisibility,
    getLayout,
    setLayout,
    persistLayout,
  });

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
    getRegionSettings: (regionId) => input.getRegionSettings?.(regionId),
    getRegionCollapsible: regionQueries.getRegionCollapsible,
    getRegionHeaderBorderBottom: regionQueries.getRegionHeaderBorderBottom,

    ...regionMethods,

    listPlaceholders: contributionLists.listPlaceholders,
    listWidgets: contributionLists.listWidgets,
    ...panelMethods,
    openWidget: ownedMenus.openWidget,

    ...placementMethods,

    establishLocation,

    reconcilePanelMenus: ownedMenus.reconcilePanelMenus,

    ...regionContentMethods,

    getLayout,

    setPersistenceScope: scopeMethods.setPersistenceScope,
    getPersistenceScope: scopeMethods.getPersistenceScope,
    hasPersistedLayout: scopeMethods.hasPersistedLayout,
    enteredWithPersistedLayout: scopeMethods.enteredWithPersistedLayout,
    onWillChangePersistenceScope: scopeMethods.onWillChangePersistenceScope,
    onDidChangePersistenceScope: scopeMethods.onDidChangePersistenceScope,
  };
};
