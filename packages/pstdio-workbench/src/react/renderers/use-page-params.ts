import { resolvePageParams } from "pstdio-api-contracts";
import type { WorkbenchCore, WorkbenchPanelInstance } from "../../core";
import { useWorkbenchStore } from "../shared/use-workbench-store";

export const usePageParams = (workbench: WorkbenchCore, placement?: WorkbenchPanelInstance) => {
  const state = useWorkbenchStore(workbench.pages.store, (state) => state);
  const owner = placement?.placementIdentity;
  if (owner?.kind !== "page" || owner.pageId !== state.activePageId) return undefined;
  return resolvePageParams(state.pages[owner.pageId]?.params, state.location?.params);
};
