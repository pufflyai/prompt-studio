import {
  activateInLayout,
  findPlacementByWidgetId,
  removeLocationSubPanelSelection,
  selectRegionActiveWidget,
} from "../../registries/layout/layout-operations";
import type {
  WorkbenchPanelRegion,
  WorkbenchRegion,
  WorkbenchRegionState,
  WorkbenchTabPosition,
} from "../../registries/layout/layout-types";
import { workbenchPanelRegions } from "../../registries/layout/layout-types";
import { planTrayDrop } from "../../registries/layout/tray-tabs";
import { batchWorkbenchChanges } from "../../shared/store/workbench-batch";
import { revealPanelRegion } from "../../workbench-core-navigation";
import type { WorkbenchCore } from "../../workbench-core-types";
import { panelDestinations } from "./panel-destinations";

const keepSourceVisible = (source: WorkbenchRegionState, region: WorkbenchRegion, tabCount: number) =>
  source.visible && (tabCount > 0 || region === "main");

const revealDropTarget = (target: WorkbenchRegionState) => ({
  ...target,
  visible: true,
  presentation: target.id === "side" && !target.visible ? ("attached" as const) : target.presentation,
});

export const createPanelArrangement = (resolve: () => WorkbenchCore) => ({
  getPanelDestinations(instanceId: string) {
    const core = resolve();
    const found = findPlacementByWidgetId(core.layout.getLayout(), instanceId);
    return found ? panelDestinations(core, found.placement.contributionId) : [];
  },
  movePanel(instanceId: string, destination: WorkbenchPanelRegion, position: WorkbenchTabPosition = "end") {
    const core = resolve();
    const initial = findPlacementByWidgetId(core.layout.getLayout(), instanceId);
    if (!initial) throw new Error(`Panel instance not found: ${instanceId}`);
    if (
      !workbenchPanelRegions.some((region) => region === initial.regionId) ||
      !panelDestinations(core, initial.placement.contributionId).includes(destination)
    )
      throw new Error(`Panel cannot move to ${destination}: ${instanceId}`);
    batchWorkbenchChanges(() => {
      // Retention belongs to the owner; pin it there before moving the rendered tab.
      if (initial.placement.tabRetention === "preview" && initial.placement.placementIdentity)
        core.pinPlacement(initial.placement.placementIdentity);
      const layout = core.layout.getLayout();
      const found = findPlacementByWidgetId(layout, instanceId)!;
      const source = layout.regions[found.regionId];
      const remaining = source.widgets.filter((t) => t.widgetId !== instanceId);
      const target = layout.regions[destination];
      const plan = planTrayDrop(destination === found.regionId ? remaining : target.widgets, found.placement, position);
      const next = {
        ...removeLocationSubPanelSelection(layout, instanceId),
        regions: {
          ...layout.regions,
          [found.regionId]: {
            ...source,
            widgets: remaining,
            visible: keepSourceVisible(source, found.regionId, remaining.length),
            activeWidgetId:
              source.activeWidgetId === instanceId
                ? (remaining[found.index] ?? remaining[found.index - 1])?.widgetId
                : source.activeWidgetId,
          },
          [destination]: {
            ...revealDropTarget(target),
            widgets: plan.widgets,
          },
        },
      };
      // Moving selects the instance directly; navigation owns auxiliary-selection restoration.
      const selected =
        found.placement.role === "location"
          ? (selectRegionActiveWidget(next, destination, instanceId) ?? next)
          : activateInLayout(next, destination, found.placement);
      core.layout.restoreLayout({
        ...selected,
        activeWidgetId: instanceId,
        activeResourceKey: found.placement.resourceKey,
        activeLocationWidgetId: found.placement.role === "location" ? instanceId : layout.activeLocationWidgetId,
      });
      core.layout.reconcilePanelMenus();
      revealPanelRegion(core, destination);
    });
  },
});
