import type { WorkbenchLayout, WorkbenchRegion, WorkbenchRegionSize } from "./layout-types";

/** Clamp only after the incoming mode has published its policy. */
export const clampPanelSizes = (
  layout: WorkbenchLayout,
  getSize: (region: WorkbenchRegion) => WorkbenchRegionSize | undefined,
) => {
  let changed = false;
  const regions = { ...layout.regions };
  for (const region of Object.values(regions)) {
    const bounds = getSize(region.id);
    if (region.size === undefined || !bounds) continue;
    const size = Math.min(bounds.maxPx ?? Infinity, Math.max(bounds.minPx ?? 0, region.size));
    if (size === region.size) continue;
    regions[region.id] = { ...region, size };
    changed = true;
  }
  return changed ? { ...layout, regions } : layout;
};
