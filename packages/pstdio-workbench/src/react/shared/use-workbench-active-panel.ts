import {
  getActiveWorkbenchLocationPanel,
  isWorkbenchPanelPlacementVisible,
  type WorkbenchCore,
  type WorkbenchPanelRegion,
} from "../../core";
import { resolvePageContent } from "../../core/registries/pages/page-content";
import { useWorkbenchStore } from "./use-workbench-store";

/** Content actions use the selected instance in their own panel, independently of focus and Main. */
export const useWorkbenchActivePanel = (workbench: WorkbenchCore, region: WorkbenchPanelRegion) => {
  "use no memo";
  useWorkbenchStore(workbench.layout.store, (state) => state);
  useWorkbenchStore(workbench.pages.store, (state) => state);
  useWorkbenchStore(workbench.modes.store, (state) => state.activeModeId);
  useWorkbenchStore(workbench.resources.preview.store, (state) => state.changes);
  return resolveWorkbenchActivePanel(workbench, region);
};

export const resolveWorkbenchActivePanel = (workbench: WorkbenchCore, region: WorkbenchPanelRegion) => {
  const layout = workbench.layout.store.getState();
  const pages = workbench.pages.store.getState();
  const modeId = workbench.modes.getActiveModeId();
  const content = region === "main" ? resolvePageContent(pages) : undefined;
  if (content) return content;
  const panel = layout.layout.regions[region];
  const placements = panel.widgets.filter((placement) => {
    if (placement.resource && !workbench.resources.preview.resolve(placement.resource)) return false;
    const widget = layout.widgets[placement.contributionId];
    return (
      widget &&
      isWorkbenchPanelPlacementVisible(widget, workbench.getPrimaryResource(), modeId, placement, {
        ignoreResourceLocation: region !== "main",
        location: getActiveWorkbenchLocationPanel(layout.layout),
      })
    );
  });
  return placements.find((placement) => placement.widgetId === panel.activeWidgetId) ?? placements[0];
};
