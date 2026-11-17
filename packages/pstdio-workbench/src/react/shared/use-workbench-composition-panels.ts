import type { WorkbenchCompositionRegionPanels, WorkbenchCore, WorkbenchPanelRegion } from "../../core";
import { useWorkbenchStore } from "./use-workbench-store";

export type WorkbenchCompositionPanelsByRegion = Record<WorkbenchPanelRegion, WorkbenchCompositionRegionPanels>;

const useWorkbenchCompositionChanges = (workbench: WorkbenchCore) => {
  "use no memo";

  useWorkbenchStore(workbench.layout.store, (state) => state);
  useWorkbenchStore(workbench.modes.store, (state) => state.activeModeId);
  useWorkbenchStore(workbench.pages.store, (state) => state);
  useWorkbenchStore(workbench.commands.store, (state) => state);
  useWorkbenchStore(workbench.context.store, (state) => state);
};

export const useWorkbenchCompositionRegionPanels = (workbench: WorkbenchCore, region?: WorkbenchPanelRegion) => {
  "use no memo";

  useWorkbenchCompositionChanges(workbench);
  return region ? workbench.composition.panelsFor(region) : { open: [], addable: [], closable: [] };
};

export const useWorkbenchCompositionPanels = <Region extends WorkbenchPanelRegion>(
  workbench: WorkbenchCore,
  regions: readonly Region[],
) => {
  "use no memo";

  useWorkbenchCompositionChanges(workbench);

  const panels = {} as Record<Region, WorkbenchCompositionRegionPanels>;
  for (const region of regions) panels[region] = workbench.composition.panelsFor(region);
  return panels;
};
