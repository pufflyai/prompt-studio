import type { WorkbenchCore } from "../../core";
import { useHasSystemNotices } from "../notifications/system-error-state";
import { useWorkbenchStore } from "../shared/use-workbench-store";

/** Match the current mode's status content before reserving space for the strip. */
export const useStatusBarVisibility = (workbench: WorkbenchCore) => {
  // Item visibility can depend on the mode even when both modes use default chrome.
  const { activeModeId, modes } = useWorkbenchStore(workbench.modes.store, (state) => state);
  const chrome = activeModeId ? modes[activeModeId]?.chrome?.status : undefined;
  const hasItems = useWorkbenchStore(workbench.statusBar.store, () =>
    workbench.statusBar.listVisibleItems().some((item) => item.system || chrome === undefined),
  );
  const hasModeView = useWorkbenchStore(workbench.views.store, (state) =>
    typeof chrome === "string" ? Boolean(state.views[chrome]) : false,
  );
  const hasNotices = useHasSystemNotices(workbench);
  const hasStatusContent = hasItems || hasModeView || hasNotices;
  return { hasStatusContent, hasDockedStatusBar: chrome !== false && hasStatusContent };
};
