import type { WorkbenchCore } from "./workbench-core-types";

export const navigateCoreMode = (core: WorkbenchCore | undefined, modeId: string) => {
  if (!core?.pages.store.getState().projectId) return false;
  const state = core.pages.store.getState();
  const restricted = state.activePageId && state.pages[state.activePageId]?.modeIds;
  if (
    !core.modes.getMode(modeId)?.basePage &&
    !restricted &&
    !core.pages.listAvailablePages(modeId).some((page) => page.modeIds)
  )
    return false;
  const result = core.pageLocations.switchMode(modeId);
  if (!result.ok) throw new Error(result.diagnostic.message);
  return true;
};
