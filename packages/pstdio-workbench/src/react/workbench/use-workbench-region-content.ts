import {
  getActiveWorkbenchLocationPanel,
  getWorkbenchModePanelForRegion,
  isWorkbenchModePanelAvailable,
  isWorkbenchPanelPlacementVisible,
  matchesWorkbenchModeEligibility,
  type WorkbenchCore,
  type WorkbenchRegion,
} from "../../core";
import { resolvePageContent } from "../../core/registries/pages/page-content";
import { useModeChrome } from "../region/mode-chrome";
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
  const chrome = useModeChrome(workbench, region);
  const resource = useWorkbenchLocationResource(workbench);
  const modeId = useWorkbenchActiveModeId(workbench);
  const hasPageContent = useWorkbenchStore(workbench.pages.store, (state) => {
    const page = state.pages[state.activePageId ?? ""];
    return region === "main" && Boolean(resolvePageContent(state) || page?.main.empty);
  });
  const modePanel = getWorkbenchModePanelForRegion(region);
  const panelAvailable =
    !modePanel || isWorkbenchModePanelAvailable(modeId ? workbench.modes.getMode(modeId) : undefined, modePanel);

  return useWorkbenchStore(workbench.layout.store, (state) => {
    if (chrome !== undefined) return chrome !== false;
    if (!panelAvailable) return false;
    if (hasPageContent) return true;
    if (state.placeholders[region]) return true;
    if (!options.locationScoped) return state.layout.regions[region].widgets.length > 0;

    return state.layout.regions[region].widgets.some((placement) => {
      const widget = state.widgets[placement.contributionId];
      if (!widget) return false;
      return region === "side"
        ? matchesWorkbenchModeEligibility(widget, modeId)
        : isWorkbenchPanelPlacementVisible(widget, resource, modeId, placement, {
            location: getActiveWorkbenchLocationPanel(state.layout),
          });
    });
  });
};
