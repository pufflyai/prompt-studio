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

export const useWorkbenchCompositionRegionPanels = (workbench: WorkbenchCore, region: WorkbenchPanelRegion) => {
  "use no memo";

  useWorkbenchCompositionChanges(workbench);
  return workbench.composition.panelsFor(region);
};

export const useWorkbenchCompositionPanels = (workbench: WorkbenchCore): WorkbenchCompositionPanelsByRegion => {
  "use no memo";

  useWorkbenchCompositionChanges(workbench);

  return {
    main: workbench.composition.panelsFor("main"),
    secondary: workbench.composition.panelsFor("secondary"),
    side: workbench.composition.panelsFor("side"),
  };
};
