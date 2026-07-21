import type { WorkbenchCore } from "../../core";
import { useWorkbenchStore } from "./use-workbench-store";

export const useWorkbenchLocationResource = (workbench: WorkbenchCore) => {
  const activeLocationWidgetId = useWorkbenchStore(
    workbench.layout.store,
    (state) => state.layout.activeLocationWidgetId,
  );
  return activeLocationWidgetId ? workbench.getPrimaryResource() : undefined;
};

export const useWorkbenchActiveModeId = (workbench: WorkbenchCore) =>
  useWorkbenchStore(workbench.modes.store, (state) => state.activeModeId);
