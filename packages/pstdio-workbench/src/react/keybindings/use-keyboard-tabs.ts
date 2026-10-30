import type { WorkbenchCore } from "../../core";
import { useWorkbenchStore } from "../shared/use-workbench-store";

export const useKeyboardTabs = (workbench: WorkbenchCore) => {
  "use no memo";
  const keyboard = useWorkbenchStore(workbench.keyboard.store, (state) => state);
  useWorkbenchStore(workbench.layout.store, (state) => state.layout);
  return { keyboard, tabs: workbench.keyboard.listTabs() };
};
