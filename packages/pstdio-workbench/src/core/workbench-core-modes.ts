import type { WorkbenchCore } from "./workbench-core-types";

export const navigateCoreMode = (core: WorkbenchCore | undefined, modeId: string) => {
  if (!core?.pages.store.getState().projectId) return false;
  if (!core.modes.getMode(modeId)?.basePage && !core.pages.listAvailablePages(modeId).some((page) => page.modeIds))
    return false;
  const result = core.pageLocations.switchMode(modeId);
  if (!result.ok) throw new Error(result.diagnostic.message);
  return true;
};
