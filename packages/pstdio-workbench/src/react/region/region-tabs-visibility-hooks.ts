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
import { suppressesSidenavTabStrip } from "./region-tabs-visibility";

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

const isSubPanelPlacement = (placement: WorkbenchWidgetPlacement) => placement.role === "sub-panel";

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

export const useWorkbenchPanelHeaderVisible = (workbench: WorkbenchCore, region: WorkbenchPanelRegion) => {
  const commands = useWorkbenchStore(workbench.commands.store, (state) => state.commands);
  const contextValues = useWorkbenchStore(workbench.context.store, (state) => state.values);
  const layoutState = useWorkbenchStore(workbench.layout.store, (state) => state);
  const itemsByPath = useWorkbenchStore(workbench.layout.menuStore, (state) => state.itemsByPath);
  const resource = useWorkbenchLocationResource(workbench);
  const modeId = useWorkbenchActiveModeId(workbench);
  const compositionPanels = useWorkbenchCompositionPanels(workbench)[region];
  const activeSubPanel = getActiveWorkbenchSubPanel(layoutState.layout, region, resource, {
    ignoreOwnerResourceUri: region === "side",
  });
  const activeLocationPanel = getActiveWorkbenchLocationPanel(layoutState.layout);
  const openSubPanels = layoutState.layout.regions[region].widgets.filter(
    (placement) =>
      isSubPanelPlacement(placement) && isPlacementEligibleForRegion(workbench, region, placement, resource, modeId),
  );
  const hasMultipleLocations =
    region === "main" &&
    layoutState.layout.regions.main.widgets.filter(
      (placement) =>
        placement.role === "location" && !workbench.layout.getWidget(placement.contributionId)?.subPanelsOnly,
    ).length > 1;
  const eligibleSubPanels = compositionPanels.addable;
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
  const compositionPanels = useWorkbenchCompositionPanels(workbench);
  const placements = layoutState.layout.regions[region].widgets.filter(
    (placement) =>
      isSubPanelPlacement(placement) && isPlacementEligibleForRegion(workbench, region, placement, resource, modeId),
  );
  const locationTabs =
    region === "main"
      ? layoutState.layout.regions.main.widgets.filter(
          (placement) =>
            placement.role === "location" && !workbench.layout.getWidget(placement.contributionId)?.subPanelsOnly,
        )
      : [];
  const leadingItems = listWorkbenchMenuItemsFromState(
    { itemsByPath, commands, contextValues },
    workbenchRegionTabLeadingMenuPath(region),
  );

  const tabPlacements = suppressesSidenavTabStrip(region, placements)
    ? []
    : locationTabs.length > 1
      ? [...locationTabs, ...placements]
      : placements;

  return shouldShowRegionTabs(tabPlacements, {
    hasLeadingActions: leadingItems.length > 0,
    hasAddAction: isWorkbenchPanelRegion(region) && compositionPanels[region].addable.length > 0,
  });
};
