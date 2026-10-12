import type { WorkbenchLayout, WorkbenchRegion, WorkbenchRegionSettings } from "./layout-types";

export const clampPanelSizes = (
  layout: WorkbenchLayout,
  getSettings: (region: WorkbenchRegion) => WorkbenchRegionSettings | undefined,
) => {
  let next = layout;
  for (const [id, state] of Object.entries(layout.regions) as [
    WorkbenchRegion,
    WorkbenchLayout["regions"][WorkbenchRegion],
  ][]) {
    const bounds = getSettings(id)?.size;
    if (state.size === undefined || !bounds) continue;
    const size = Math.min(bounds.maxPx ?? Infinity, Math.max(bounds.minPx ?? 0, state.size));
    if (state.size !== size) next = { ...next, regions: { ...next.regions, [id]: { ...state, size } } };
  }
  return next;
};
