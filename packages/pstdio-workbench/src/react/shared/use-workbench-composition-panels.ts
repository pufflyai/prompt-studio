import { useSyncExternalStore } from "react";
import type { WorkbenchCompositionRegionPanels, WorkbenchCore, WorkbenchPanelRegion } from "../../core";
import { compositionPanelSnapshot } from "./composition-panel-snapshot";

export type WorkbenchCompositionPanelsByRegion = Record<WorkbenchPanelRegion, WorkbenchCompositionRegionPanels>;
const empty: WorkbenchCompositionRegionPanels = { open: [], addable: [], closable: [] };
const emptyReader = { refresh: () => empty, read: () => empty, subscribe: (_changed: () => void) => () => {} };

export const useWorkbenchCompositionRegionPanels = (workbench: WorkbenchCore, region?: WorkbenchPanelRegion) => {
  "use no memo";
  const reader = region ? compositionPanelSnapshot(workbench, region) : emptyReader;
  // Opening a palette can reveal live provider availability without another store transition.
  reader.refresh();
  return useSyncExternalStore(reader.subscribe, reader.read, reader.read);
};

export const useWorkbenchCompositionPanels = (workbench: WorkbenchCore): WorkbenchCompositionPanelsByRegion => ({
  main: useWorkbenchCompositionRegionPanels(workbench, "main"),
  secondary: useWorkbenchCompositionRegionPanels(workbench, "secondary"),
  side: useWorkbenchCompositionRegionPanels(workbench, "side"),
});
