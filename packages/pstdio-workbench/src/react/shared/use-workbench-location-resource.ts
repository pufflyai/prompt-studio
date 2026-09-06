import type { WorkbenchCore } from "../../core";
import { useWorkbenchStore } from "./use-workbench-store";

export const useWorkbenchLocationResource = (workbench: WorkbenchCore) =>
  useWorkbenchStore(workbench.pages.store, (state) => state.location?.resource);

export const useWorkbenchActiveModeId = (workbench: WorkbenchCore) =>
  useWorkbenchStore(workbench.modes.store, (state) => state.activeModeId);
