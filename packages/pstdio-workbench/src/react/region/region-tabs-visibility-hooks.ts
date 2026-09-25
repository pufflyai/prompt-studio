import { filterVisibleTabs, useTabVisibilityStore } from "@pstdio/ui";
import {
  getActiveWorkbenchLocationPanel,
  getAnchorResource,
  headerTrailingMenuPath,
  isWorkbenchPanelPlacementVisible,
  type WorkbenchCore,
  type WorkbenchPanelRegion,
  type WorkbenchRegion,
  type WorkbenchWidgetPlacement,
  workbenchPanelRegions,
  workbenchRegionTabLeadingMenuPath,
} from "../../core";
import { listWorkbenchMenuItemsFromState } from "../menus/menu-items";
import { useWorkbenchPanelMenus } from "../panel-menu/panel-menu";
import { useWorkbenchCompositionPanels } from "../shared/use-workbench-composition-panels";
import { useWorkbenchActiveModeId, useWorkbenchLocationResource } from "../shared/use-workbench-location-resource";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { suppressesSidenavTabStrip, toTabKey } from "./region-tabs-visibility";

const isWorkbenchPanelRegion = (region: WorkbenchRegion): region is WorkbenchPanelRegion =>
  workbenchPanelRegions.some((panelRegion) => panelRegion === region);

export const shouldShowRegionTabs = (
  placements: WorkbenchWidgetPlacement[],
  options: { alwaysShowTabs?: boolean } = {},
) => placements.length > 1 || (placements.length === 1 && (options.alwaysShowTabs ?? placements[0]?.closable) === true);

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
    (placement) => visibleSubPanelIds.has(placement.widgetId) || (region === "main" && placement.role === "location"),
  );
  const leadingItems = listWorkbenchMenuItemsFromState(
    { itemsByPath, commands, contextValues },
    workbenchRegionTabLeadingMenuPath(region),
  );
  const panelRegion = isWorkbenchPanelRegion(region) ? region : undefined;
  const eligibleSubPanels = panelRegion ? compositionPanels[panelRegion].addable : [];
  const showTabs =
    !suppressesSidenavTabStrip(region, visiblePlacements) &&
    shouldShowRegionTabs(visiblePlacements, {
      alwaysShowTabs: workbench.layout.getRegionSettings(region)?.alwaysShowTabs,
    });
  const hasActions = leadingItems.length > 0 || eligibleSubPanels.length > 0;
  const hasTrailingActions =
    region === "main" &&
    listWorkbenchMenuItemsFromState({ itemsByPath, commands, contextValues }, headerTrailingMenuPath(region), {
      resource: getAnchorResource(layoutState.layout, "primary"),
    }).length > 0;

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
    hasTrailingActions,
  };
};

export const useWorkbenchPanelHeaderVisible = (workbench: WorkbenchCore, region: WorkbenchPanelRegion) => {
  const { showTabs, hasActions, hasTrailingActions } = useWorkbenchRegionTabsState(workbench, region);
  const { left, right } = useWorkbenchPanelMenus(workbench, region);
  const hasPanelMenus = [left, right].some((menu) => menu.has && menu.collapsed);
  return shouldShowPanelHeader({
    hasTabs: showTabs,
    hasHeaderActions: hasActions || hasTrailingActions,
    hasPanelMenus,
  });
};

export const useWorkbenchRegionTabsVisible = (workbench: WorkbenchCore, region: WorkbenchRegion) => {
  const { showTabs, hasActions } = useWorkbenchRegionTabsState(workbench, region);
  return showTabs || hasActions;
};
