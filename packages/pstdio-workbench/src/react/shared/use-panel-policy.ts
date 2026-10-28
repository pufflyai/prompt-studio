import { useShallow } from "zustand/react/shallow";
import type { WorkbenchCore, WorkbenchRegion } from "../../core";
import { useWorkbenchStore } from "./use-workbench-store";

export const usePanelPolicy = (workbench: WorkbenchCore, region: WorkbenchRegion) => {
  useWorkbenchStore(workbench.modes.store, (state) => state.activeModeId);
  useWorkbenchStore(workbench.pages.store, (state) => state.activePageId);
  return useWorkbenchStore(
    workbench.layout.store,
    useShallow(() => workbench.shell.getPanelPolicy(region)),
  );
};
