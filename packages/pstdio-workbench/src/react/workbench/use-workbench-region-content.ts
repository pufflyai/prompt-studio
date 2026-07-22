import { matchesWorkbenchPanelPlacementLocation, type WorkbenchCore, type WorkbenchRegion } from "../../core";
import { useWorkbenchActiveModeId, useWorkbenchLocationResource } from "../shared/use-workbench-location-resource";
import { useWorkbenchStore } from "../shared/use-workbench-store";

interface WorkbenchRegionContentOptions {
  locationScoped?: boolean;
}

export const useWorkbenchRegionContent = (
  workbench: WorkbenchCore,
  region: WorkbenchRegion,
  options: WorkbenchRegionContentOptions = {},
) => {
  const resource = useWorkbenchLocationResource(workbench);
  const modeId = useWorkbenchActiveModeId(workbench);

  return useWorkbenchStore(workbench.layout.store, (state) => {
    if (state.placeholders[region]) return true;
    if (!options.locationScoped) return state.layout.regions[region].widgets.length > 0;

    return state.layout.regions[region].widgets.some((placement) => {
      const widget = state.widgets[placement.contributionId];
      return widget ? matchesWorkbenchPanelPlacementLocation(widget, resource, modeId, placement) : false;
    });
  });
};
