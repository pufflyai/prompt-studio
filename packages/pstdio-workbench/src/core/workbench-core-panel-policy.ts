import type { WorkbenchRegion } from "./registries/layout/layout-types";
import { getWorkbenchPageRegistryInternals } from "./registries/pages/page-registry-internals";
import type { createWorkbenchInput, WorkbenchCore } from "./workbench-core-types";

export const resolveRegionSettings = (
  input: createWorkbenchInput,
  core: WorkbenchCore | undefined,
  regionId: WorkbenchRegion,
) => {
  const pageId = core ? getWorkbenchPageRegistryInternals(core.pages).getPublishingState().activePageId : undefined;
  const page = pageId ? core?.pages.getPage(pageId) : undefined;
  if (regionId === "bottom" || regionId === "aside") return page?.regionSettings?.[regionId];
  const activeModeId = core?.modes.getActiveModeId();
  const activeMode = activeModeId ? core?.modes.getMode(activeModeId) : undefined;
  return {
    ...input.regionSettings?.[regionId],
    ...activeMode?.regionSettings?.[regionId],
    ...(regionId === "main" ? page?.regionSettings?.main : undefined),
  };
};
