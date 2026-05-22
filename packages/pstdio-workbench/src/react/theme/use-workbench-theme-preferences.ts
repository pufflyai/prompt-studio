import { defaultThemePreferences } from "@pstdio/ui";
import type { WorkbenchCore } from "../../core";
import { useWorkbenchStore } from "../shared/use-workbench-store";

// The theme set a workbench offers: the built-in workbench themes plus whatever
// is registered in `workbench.themes` (e.g. extension-contributed themes). The
// list shrinks when a contribution is disposed, so the theme picker only ever
// lists themes whose owner is still active.
export const useWorkbenchThemePreferences = (workbench: WorkbenchCore) => {
  const contributed = useWorkbenchStore(workbench.themes.store, (state) => state.themes);
  return [...defaultThemePreferences, ...contributed];
};
