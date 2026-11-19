import { useEffect } from "react";
import type { WorkbenchCore } from "../../core";
import { useWorkbenchStore } from "../shared/use-workbench-store";

/** A mode-owned strip is one status widget; it uses the same placement owner as contributed widgets. */
export const useStatusBarChrome = (
  workbench: WorkbenchCore,
  modeId: string | undefined,
  chrome: string | false | undefined,
) => {
  const view = useWorkbenchStore(workbench.views.store, (state) =>
    typeof chrome === "string" ? state.views[chrome] : undefined,
  );
  const id = typeof chrome === "string" ? JSON.stringify(["mode-status", modeId, chrome]) : undefined;
  useEffect(() => {
    if (!id || !view || typeof chrome !== "string") return;
    const owner = workbench.statusBar.registerItem({
      id,
      viewId: chrome,
      slot: "leading",
      isVisible: () => {
        const state = workbench.modes.store.getState();
        return state.activeModeId === modeId && state.modes[modeId ?? ""]?.chrome?.status === chrome;
      },
    });
    return () => owner.dispose();
  }, [workbench, modeId, chrome, id, view]);
  return id;
};
