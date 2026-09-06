import { useShallow } from "zustand/react/shallow";
import type { WorkbenchCore, WorkbenchRegion } from "../../core";
import { useWorkbenchStore } from "./use-workbench-store";

// Read mode policy through its store so the React compiler sees policy changes.
export const useWorkbenchModeRegionSettings = (workbench: WorkbenchCore, region: WorkbenchRegion) =>
  useWorkbenchStore(
    workbench.modes.store,
    useShallow(() => workbench.layout.getRegionSettings(region)),
  );
