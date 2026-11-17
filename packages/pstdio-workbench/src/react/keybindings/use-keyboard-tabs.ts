import type { WorkbenchCore } from "../../core";
import { useWorkbenchStore } from "../shared/use-workbench-store";

const hiddenHints = { active: false, preview: false, selectedId: undefined };

export const useKeyboardTabs = (workbench: WorkbenchCore) => {
  "use no memo";
  const keyboard = useWorkbenchStore(workbench.keyboard.store, (state) =>
    state.active || state.preview ? state : hiddenHints,
  );
  const visible = keyboard.active || keyboard.preview;
  useWorkbenchStore(workbench.layout.store, (state) => (visible ? state.layout : undefined));
  return { keyboard, tabs: visible ? workbench.keyboard.listTabs() : [] };
};
