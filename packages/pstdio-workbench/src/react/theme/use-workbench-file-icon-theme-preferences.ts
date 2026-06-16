import type { FileIconThemePreferenceOption } from "@pstdio/ui";
import type { WorkbenchCore } from "../../core";
import { useWorkbenchStore } from "../shared/use-workbench-store";

// The file icon themes a workbench offers: whatever is registered in
// `workbench.fileIconThemes` (e.g. extension-contributed themes). The list
// shrinks when a contribution is disposed, mirroring color themes.
export const useWorkbenchFileIconThemePreferences = (workbench: WorkbenchCore) =>
  useWorkbenchStore(
    workbench.fileIconThemes.store,
    (state) => state.themes,
  ) as readonly FileIconThemePreferenceOption[];
