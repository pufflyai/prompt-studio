import {
  getActiveWorkbenchLocationPanel,
  getWorkbenchPanelForMenuRegion,
  isWorkbenchPanelPlacementVisible,
  matchesWorkbenchPanelMenuOwner,
  type WorkbenchCore,
  type WorkbenchPanelMenuRegion,
} from "../../core";
import { resolveWorkbenchActivePanel } from "../shared/use-workbench-active-panel";

/** Resolve menu content against its own panel's selected owner, including auxiliary resources. */
export const resolvePanelMenuRegionState = (workbench: WorkbenchCore, region: WorkbenchPanelMenuRegion) => {
  const panel = getWorkbenchPanelForMenuRegion(region);
  const state = workbench.layout.store.getState();
  const selected = resolveWorkbenchActivePanel(workbench, panel);
  const subPanel = selected?.role === "sub-panel" ? selected : undefined;
  const locationPanel = subPanel ? getActiveWorkbenchLocationPanel(state.layout) : selected;
  const current = state.layout.regions[region];
  return {
    ...current,
    widgets: current.widgets.filter((placement) => {
      const widget = state.widgets[placement.contributionId];
      return (
        widget &&
        isWorkbenchPanelPlacementVisible(
          widget,
          workbench.getPrimaryResource(),
          workbench.modes.getActiveModeId(),
          placement,
          {
            ignoreResourceLocation: panel !== "main",
            location: locationPanel,
          },
        ) &&
        matchesWorkbenchPanelMenuOwner(widget, { locationPanel, subPanel })
      );
    }),
  };
};
