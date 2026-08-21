import type { WorkbenchCompositionRegionPanels, WorkbenchCore, WorkbenchPanelRegion } from "../../core";
import { useWorkbenchStore } from "./use-workbench-store";

export type WorkbenchCompositionPanelsByRegion = Record<WorkbenchPanelRegion, WorkbenchCompositionRegionPanels>;

export const useWorkbenchCompositionPanels = (workbench: WorkbenchCore): WorkbenchCompositionPanelsByRegion => {
  "use no memo";

  useWorkbenchStore(workbench.layout.store, (state) => state);
  useWorkbenchStore(workbench.modes.store, (state) => state.activeModeId);

  return {
    main: workbench.composition.panelsFor("main"),
    secondary: workbench.composition.panelsFor("secondary"),
    side: workbench.composition.panelsFor("side"),
  };
};
