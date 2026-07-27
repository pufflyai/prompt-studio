import {
  getActiveWorkbenchLocationPanel,
  getActiveWorkbenchSubPanel,
  getWorkbenchModePanelForRegion,
  isWorkbenchModePanelAvailable,
  listEligibleSubPanels,
  matchesWorkbenchPanelMenuOwner,
  matchesWorkbenchPanelPlacementLocation,
  type WorkbenchCore,
  type WorkbenchPanelRegion,
  type WorkbenchRegion,
  type WorkbenchWidgetPlacement,
  workbenchPanelMenuRegions,
  workbenchPanelRegions,
  workbenchRegionTabLeadingMenuPath,
} from "../../core";
import { listWorkbenchMenuItemsFromState } from "../menus/menu-items";
import { useWorkbenchActiveModeId, useWorkbenchLocationResource } from "../shared/use-workbench-location-resource";
import { useWorkbenchStore } from "../shared/use-workbench-store";

const isPlacementCloseable = (placement: WorkbenchWidgetPlacement) => placement.closable === true;

const isWorkbenchPanelRegion = (region: WorkbenchRegion): region is WorkbenchPanelRegion =>
  workbenchPanelRegions.some((panelRegion) => panelRegion === region);

export const shouldShowRegionTabs = (
  placements: WorkbenchWidgetPlacement[],
  options: { hasLeadingActions?: boolean; hasAddAction?: boolean } = {},
) =>
  options.hasAddAction === true ||
  options.hasLeadingActions === true ||
  placements.length > 0 ||
  placements.some(isPlacementCloseable);

interface WorkbenchPanelHeaderVisibility {
  hasOpenSubPanels?: boolean;
  hasEligibleSubPanels?: boolean;
  hasPanelMenus?: boolean;
  hasHeaderActions?: boolean;
}

export const shouldShowPanelHeader = (input: WorkbenchPanelHeaderVisibility) =>
  input.hasOpenSubPanels === true ||
  input.hasEligibleSubPanels === true ||
  input.hasPanelMenus === true ||
  input.hasHeaderActions === true;

const isSubPanelPlacement = (workbench: WorkbenchCore, placement: WorkbenchWidgetPlacement) =>
  (placement.role ?? workbench.layout.getWidget(placement.contributionId)?.role) === "sub-panel";

export const isPlacementEligibleForRegion = (
  workbench: WorkbenchCore,
  region: WorkbenchRegion,
  placement: WorkbenchWidgetPlacement,
  resource = workbench.getPrimaryResource(),
  modeId = workbench.modes.getActiveModeId(),
) => {
  const widget = workbench.layout.getWidget(placement.contributionId);
  return widget
    ? matchesWorkbenchPanelPlacementLocation(widget, resource, modeId, placement, {
        ignoreResourceLocation: region === "side",
      })
    : false;
};

export const useWorkbenchPanelHeaderVisible = (workbench: WorkbenchCore, region: WorkbenchPanelRegion) => {
  const commands = useWorkbenchStore(workbench.commands.store, (state) => state.commands);
  const contextValues = useWorkbenchStore(workbench.context.store, (state) => state.values);
  const layoutState = useWorkbenchStore(workbench.layout.store, (state) => state);
  const itemsByPath = useWorkbenchStore(workbench.layout.menuStore, (state) => state.itemsByPath);
  const resource = useWorkbenchLocationResource(workbench);
  const modeId = useWorkbenchActiveModeId(workbench);
  if (!isWorkbenchModePanelAvailable(modeId ? workbench.modes.getMode(modeId) : undefined, region)) return false;
  const activeSubPanel = getActiveWorkbenchSubPanel(layoutState.layout, region, resource, {
    ignoreOwnerResourceUri: region === "side",
  });
  const activeLocationPanel = getActiveWorkbenchLocationPanel(layoutState.layout);
  const openSubPanels = layoutState.layout.regions[region].widgets.filter(
    (placement) =>
      isSubPanelPlacement(workbench, placement) &&
      isPlacementEligibleForRegion(workbench, region, placement, resource, modeId),
  );
  const hasMultipleLocations =
    region === "main" &&
    layoutState.layout.regions.main.widgets.filter(
      (placement) => (placement.role ?? workbench.layout.getWidget(placement.contributionId)?.role) === "location",
    ).length > 1;
  const eligibleSubPanels = listEligibleSubPanels({
    widgets: Object.values(layoutState.widgets),
    layout: layoutState.layout,
    region,
    resource,
    modeId,
  });
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
  const hasHeaderActions =
    listWorkbenchMenuItemsFromState({ itemsByPath, commands, contextValues }, workbenchRegionTabLeadingMenuPath(region))
      .length > 0;

  return shouldShowPanelHeader({
    hasOpenSubPanels: openSubPanels.length > 0 || hasMultipleLocations,
    hasEligibleSubPanels: eligibleSubPanels.length > 0,
    hasPanelMenus,
    hasHeaderActions,
  });
};

export const useWorkbenchRegionTabsVisible = (workbench: WorkbenchCore, region: WorkbenchRegion) => {
  const commands = useWorkbenchStore(workbench.commands.store, (state) => state.commands);
  const contextValues = useWorkbenchStore(workbench.context.store, (state) => state.values);
  const itemsByPath = useWorkbenchStore(workbench.layout.menuStore, (state) => state.itemsByPath);
  const layoutState = useWorkbenchStore(workbench.layout.store, (state) => state);
  const resource = useWorkbenchLocationResource(workbench);
  const modeId = useWorkbenchActiveModeId(workbench);
  const modePanel = getWorkbenchModePanelForRegion(region);
  if (modePanel && !isWorkbenchModePanelAvailable(modeId ? workbench.modes.getMode(modeId) : undefined, modePanel)) {
    return false;
  }
  const placements = layoutState.layout.regions[region].widgets.filter(
    (placement) =>
      isSubPanelPlacement(workbench, placement) &&
      isPlacementEligibleForRegion(workbench, region, placement, resource, modeId),
  );
  const locationTabs =
    region === "main"
      ? layoutState.layout.regions.main.widgets.filter(
          (placement) => (placement.role ?? workbench.layout.getWidget(placement.contributionId)?.role) === "location",
        )
      : [];
  const leadingItems = listWorkbenchMenuItemsFromState(
    { itemsByPath, commands, contextValues },
    workbenchRegionTabLeadingMenuPath(region),
  );

  return shouldShowRegionTabs(locationTabs.length > 1 ? [...locationTabs, ...placements] : placements, {
    hasLeadingActions: leadingItems.length > 0,
    hasAddAction:
      isWorkbenchPanelRegion(region) &&
      listEligibleSubPanels({
        widgets: Object.values(layoutState.widgets),
        layout: layoutState.layout,
        region,
        resource,
        modeId,
      }).length > 0,
  });
};
