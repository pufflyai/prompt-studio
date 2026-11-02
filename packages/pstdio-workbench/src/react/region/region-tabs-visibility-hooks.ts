import { filterVisibleTabs, getTabVisibilityStore, useHostStorage, useTabVisibilityStore } from "@pstdio/ui";
import { useEffect } from "react";
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
import { isSingleViewPage } from "../../core/registries/pages/page-main";
import { resolveResourcePreview } from "../../core/registries/resources/resource-preview";
import { listWorkbenchMenuItemsFromState } from "../menus/menu-items";
import { useWorkbenchPanelMenus } from "../panel-menu/use-panel-menu";
import { useWorkbenchCompositionPanels } from "../shared/use-workbench-composition-panels";
import { useWorkbenchActiveModeId, useWorkbenchLocationResource } from "../shared/use-workbench-location-resource";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { suppressesSidenavTabStrip, toTabKey } from "./region-tabs-visibility";

const isWorkbenchPanelRegion = (region: WorkbenchRegion): region is WorkbenchPanelRegion =>
  workbenchPanelRegions.some((panelRegion) => panelRegion === region);

export const shouldShowRegionTabs = (placements: WorkbenchWidgetPlacement[]) => placements.length > 0;

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
  if (placement.resource && !workbench.resources.preview.resolve(placement.resource)) return false;
  const widget = workbench.layout.getWidget(placement.contributionId);
  return widget
    ? isWorkbenchPanelPlacementVisible(widget, resource, modeId, placement, {
        ignoreResourceLocation: region === "side" || region === "secondary",
        location: getActiveWorkbenchLocationPanel(workbench.layout.getLayout()),
      })
    : false;
};

export const useWorkbenchRegionTabsState = (
  workbench: WorkbenchCore,
  region: WorkbenchRegion,
  visibilityStorageKey?: string,
) => {
  const hostStorage = useHostStorage();
  const changes = useWorkbenchStore(workbench.resources.preview.store, (state) => state.changes);
  const commands = useWorkbenchStore(workbench.commands.store, (state) => state.commands);
  const contextValues = useWorkbenchStore(workbench.context.store, (state) => state.values);
  const itemsByPath = useWorkbenchStore(workbench.layout.menuStore, (state) => state.itemsByPath);
  const layoutState = useWorkbenchStore(workbench.layout.store, (state) => state);
  const resource = useWorkbenchLocationResource(workbench);
  const modeId = useWorkbenchActiveModeId(workbench);
  const compositionPanels = useWorkbenchCompositionPanels(workbench);
  const storageKey = visibilityStorageKey ?? `${workbench.layout.getPersistenceScope() ?? "unscoped"}/${region}`;
  const tabStore = useTabVisibilityStore(storageKey, (state) => state);
  useEffect(() => {
    const subscription = workbench.onDidResetLayout(() =>
      getTabVisibilityStore(storageKey, hostStorage).getState().reset(),
    );
    return () => subscription.dispose();
  }, [workbench, storageKey, hostStorage]);
  const regionState = layoutState.layout.regions[region];
  const pageState = useWorkbenchStore(workbench.pages.store, (state) => state);
  const pageContent = region === "main" && isSingleViewPage(pageState.pages[pageState.activePageId ?? ""]);
  const subPanelPlacements = regionState.widgets.filter(
    (placement) =>
      placement.role === "sub-panel" &&
      (!placement.resource || Boolean(resolveResourcePreview(placement.resource, changes))) &&
      isPlacementEligibleForRegion(workbench, region, placement, resource, modeId),
  );
  const visibleSubPanels = filterVisibleTabs(subPanelPlacements, tabStore.tabOverrides, (placement) =>
    toTabKey(region, placement),
  );
  const visibleSubPanelIds = new Set(visibleSubPanels.map((placement) => placement.widgetId));
  const visiblePlacements = regionState.widgets.filter(
    (placement) =>
      (visibleSubPanelIds.has(placement.widgetId) || placement.role === "location") &&
      (!placement.resource || Boolean(resolveResourcePreview(placement.resource, changes))),
  );
  const leadingItems = listWorkbenchMenuItemsFromState(
    { itemsByPath, commands, contextValues },
    workbenchRegionTabLeadingMenuPath(region),
  );
  const panelRegion = isWorkbenchPanelRegion(region) ? region : undefined;
  const eligibleSubPanels = panelRegion ? compositionPanels[panelRegion].addable : [];
  const showTabs =
    !pageContent && !suppressesSidenavTabStrip(region, visiblePlacements) && shouldShowRegionTabs(visiblePlacements);
  const hasActions =
    !pageContent &&
    (leadingItems.length > 0 || (eligibleSubPanels.length > 0 && (visiblePlacements.length === 0 || showTabs)));
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

export const useWorkbenchPanelRegionTabsState = (
  workbench: WorkbenchCore,
  region: WorkbenchPanelRegion,
  visibilityStorageKey?: string,
) => {
  const [left, right] = useWorkbenchPanelMenus(workbench, region);
  const hasPanelMenus = [left, right].some((menu) => menu.has && menu.collapsed);
  const tabs = useWorkbenchRegionTabsState(workbench, region, visibilityStorageKey);
  return { ...tabs, hasPanelMenus };
};

export const useWorkbenchPanelHeaderVisible = (workbench: WorkbenchCore, region: WorkbenchPanelRegion) => {
  const { showTabs, hasActions, hasTrailingActions, hasPanelMenus } = useWorkbenchPanelRegionTabsState(
    workbench,
    region,
  );
  return shouldShowPanelHeader({
    hasTabs: showTabs,
    hasHeaderActions: hasActions || hasTrailingActions,
    hasPanelMenus,
  });
};

export const useWorkbenchRegionTabsVisible = (workbench: WorkbenchCore, region: WorkbenchPanelRegion) => {
  const { showTabs, hasActions } = useWorkbenchPanelRegionTabsState(workbench, region);
  return showTabs || hasActions;
};
