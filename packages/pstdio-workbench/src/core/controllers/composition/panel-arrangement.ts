import {
  activateInLayout,
  findPlacementByWidgetId,
  removeLocationSubPanelSelection,
  selectRegionActiveWidget,
} from "../../registries/layout/layout-operations";
import { insertAtPosition } from "../../registries/layout/layout-tab-lifecycle";
import type { WorkbenchPanelRegion, WorkbenchTabPosition } from "../../registries/layout/layout-types";
import { workbenchPanelRegions } from "../../registries/layout/layout-types";
import { batchWorkbenchChanges } from "../../shared/store/workbench-batch";
import { revealPanelRegion } from "../../workbench-core-navigation";
import type { WorkbenchCore } from "../../workbench-core-types";
import { panelDestinations } from "./panel-destinations";

export const createPanelArrangement = (resolve: () => WorkbenchCore) => ({
  getPanelDestinations(instanceId: string) {
    const core = resolve();
    const found = findPlacementByWidgetId(core.layout.getLayout(), instanceId);
    return found ? panelDestinations(core, found.placement.contributionId) : [];
  },
  movePanel(instanceId: string, destination: WorkbenchPanelRegion, position: WorkbenchTabPosition = "end") {
    const core = resolve();
    const layout = core.layout.getLayout();
    const found = findPlacementByWidgetId(layout, instanceId);
    if (!found) throw new Error(`Panel instance not found: ${instanceId}`);
    if (
      !workbenchPanelRegions.some((region) => region === found.regionId) ||
      !panelDestinations(core, found.placement.contributionId).includes(destination)
    )
      throw new Error(`Panel cannot move to ${destination}: ${instanceId}`);
    const source = layout.regions[found.regionId];
    const remaining = source.widgets.filter((t) => t.widgetId !== instanceId);
    const target = layout.regions[destination];
    const next = {
      ...removeLocationSubPanelSelection(layout, instanceId),
      regions: {
        ...layout.regions,
        [found.regionId]: {
          ...source,
          widgets: remaining,
          activeWidgetId:
            source.activeWidgetId === instanceId
              ? (remaining[found.index] ?? remaining[found.index - 1])?.widgetId
              : source.activeWidgetId,
        },
        [destination]: {
          ...target,
          visible: true,
          widgets: insertAtPosition(
            destination === found.regionId ? remaining : target.widgets,
            found.placement,
            position,
          ),
        },
      },
    };
    batchWorkbenchChanges(() => {
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
