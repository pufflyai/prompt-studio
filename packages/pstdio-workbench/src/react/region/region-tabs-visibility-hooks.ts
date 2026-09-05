import { filterVisibleTabs, useTabVisibilityStore } from "@pstdio/ui";
import {
  getActiveWorkbenchLocationPanel,
  getActiveWorkbenchSubPanel,
  isWorkbenchPanelPlacementVisible,
  matchesWorkbenchPanelMenuOwner,
  type WorkbenchCore,
  type WorkbenchPanelRegion,
  type WorkbenchRegion,
  type WorkbenchWidgetPlacement,
  workbenchPanelMenuRegions,
  workbenchPanelRegions,
  workbenchRegionTabLeadingMenuPath,
} from "../../core";
import { listWorkbenchMenuItemsFromState } from "../menus/menu-items";
import { useWorkbenchCompositionPanels } from "../shared/use-workbench-composition-panels";
import { useWorkbenchActiveModeId, useWorkbenchLocationResource } from "../shared/use-workbench-location-resource";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { suppressesSidenavTabStrip, toTabKey } from "./region-tabs-visibility";

const isWorkbenchPanelRegion = (region: WorkbenchRegion): region is WorkbenchPanelRegion =>
  workbenchPanelRegions.some((panelRegion) => panelRegion === region);

export const shouldShowRegionTabs = (
  placements: WorkbenchWidgetPlacement[],
  options: { alwaysShowTabs?: boolean } = {},
) =>
  placements.length > 1 ||
  (placements.length === 1 &&
    (options.alwaysShowTabs === true || (placements[0]?.role !== "location" && placements[0]?.closable === true)));

interface WorkbenchPanelHeaderVisibility {
  hasTabs?: boolean;
  hasPanelMenus?: boolean;
  hasHeaderActions?: boolean;
}

export const shouldShowPanelHeader = (input: WorkbenchPanelHeaderVisibility) =>
  input.hasTabs === true || input.hasPanelMenus === true || input.hasHeaderActions === true;

export const isPlacementEligibleForRegion = (
  workbench: WorkbenchCore,
  region: WorkbenchRegion,
  placement: WorkbenchWidgetPlacement,
  resource = workbench.getPrimaryResource(),
  modeId = workbench.modes.getActiveModeId(),
) => {
  const widget = workbench.layout.getWidget(placement.contributionId);
  return widget
    ? isWorkbenchPanelPlacementVisible(widget, resource, modeId, placement, {
        ignoreResourceLocation: region === "side",
        location: getActiveWorkbenchLocationPanel(workbench.layout.getLayout()),
      })
    : false;
};

export const useWorkbenchRegionTabsState = (
  workbench: WorkbenchCore,
  region: WorkbenchRegion,
  visibilityStorageKey?: string,
) => {
  const commands = useWorkbenchStore(workbench.commands.store, (state) => state.commands);
  const contextValues = useWorkbenchStore(workbench.context.store, (state) => state.values);
  const itemsByPath = useWorkbenchStore(workbench.layout.menuStore, (state) => state.itemsByPath);
  const layoutState = useWorkbenchStore(workbench.layout.store, (state) => state);
  const resource = useWorkbenchLocationResource(workbench);
  const modeId = useWorkbenchActiveModeId(workbench);
  const compositionPanels = useWorkbenchCompositionPanels(workbench);
  const tabStore = useTabVisibilityStore(visibilityStorageKey ?? region, (state) => state);
  const regionState = layoutState.layout.regions[region];
  const subPanelPlacements = regionState.widgets.filter(
    (placement) =>
      placement.role === "sub-panel" && isPlacementEligibleForRegion(workbench, region, placement, resource, modeId),
  );
  const visibleSubPanels = filterVisibleTabs(subPanelPlacements, tabStore.tabOverrides, (placement) =>
    toTabKey(region, placement),
  );
  const visibleSubPanelIds = new Set(visibleSubPanels.map((placement) => placement.widgetId));
  const visiblePlacements = regionState.widgets.filter(
    (placement) =>
      visibleSubPanelIds.has(placement.widgetId) ||
      (region === "main" &&
        placement.role === "location" &&
        !workbench.layout.getWidget(placement.contributionId)?.subPanelsOnly),
  );
  const leadingItems = listWorkbenchMenuItemsFromState(
    { itemsByPath, commands, contextValues },
    workbenchRegionTabLeadingMenuPath(region),
  );
  const panelRegion = isWorkbenchPanelRegion(region) ? region : undefined;
  const eligibleSubPanels = panelRegion ? compositionPanels[panelRegion].addable : [];
  const showTabs =
    !suppressesSidenavTabStrip(region, visiblePlacements) &&
    shouldShowRegionTabs(visiblePlacements, workbench.layout.getRegionSettings(region));
  const hasActions = leadingItems.length > 0 || eligibleSubPanels.length > 0;

  return {
    commands,
    regionState,
    resource,
    tabStore: { tabOverrides: tabStore.tabOverrides, toggleTab: tabStore.toggleTab, reset: tabStore.reset },
    subPanelPlacements,
    visiblePlacements,
    leadingItems,
    panelRegion,
    eligibleSubPanels,
    showTabs,
    hasActions,
  };
};

export const useWorkbenchPanelHeaderVisible = (workbench: WorkbenchCore, region: WorkbenchPanelRegion) => {
  const layoutState = useWorkbenchStore(workbench.layout.store, (state) => state);
  const resource = useWorkbenchLocationResource(workbench);
  const modeId = useWorkbenchActiveModeId(workbench);
  const { showTabs, hasActions } = useWorkbenchRegionTabsState(workbench, region);
  const activeSubPanel = getActiveWorkbenchSubPanel(layoutState.layout, region, resource, {
    ignoreOwnerResourceUri: region === "side",
  });
  const activeLocationPanel = getActiveWorkbenchLocationPanel(layoutState.layout);
  const menuRegions = workbenchPanelMenuRegions[region];
  const hasPanelMenus = [menuRegions.left, menuRegions.right].some(
    (menuRegion) =>
      layoutState.layout.regions[menuRegion].widgets.some(
        (placement) =>
          isPlacementEligibleForRegion(workbench, region, placement, resource, modeId) &&
          matchesWorkbenchPanelMenuOwner(layoutState.widgets[placement.contributionId], {
            locationPanel: activeLocationPanel,
            subPanel: activeSubPanel,
          }),
      ) || Boolean(workbench.layout.getPlaceholder(menuRegion)),
  );

  return shouldShowPanelHeader({ hasTabs: showTabs, hasHeaderActions: hasActions, hasPanelMenus });
};

export const useWorkbenchRegionTabsVisible = (workbench: WorkbenchCore, region: WorkbenchRegion) => {
  const { showTabs, hasActions } = useWorkbenchRegionTabsState(workbench, region);
  return showTabs || hasActions;
};
