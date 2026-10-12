import type { WorkbenchLayout, WorkbenchRegion } from "./layout-types";

export const isPageRegion = (region: WorkbenchRegion) =>
  region === "main" || region.startsWith("main-") || region === "bottom" || region.startsWith("bottom-");

export const restoreOwnerRegion = (
  layout: WorkbenchLayout,
  regionId: WorkbenchRegion,
  modeLayout?: WorkbenchLayout,
) => {
  const region = layout.regions[regionId];
  const shared = !isPageRegion(regionId) ? modeLayout?.regions[regionId] : undefined;
  if (!shared) return region;
  return { ...region, size: shared.size, visible: shared.visible, presentation: shared.presentation };
};

export const ownerRegionSelection = (
  layout: WorkbenchLayout,
  regionId: WorkbenchRegion,
  modeLayout?: WorkbenchLayout,
) => {
  const page = layout.regions[regionId].activeWidgetId;
  const mode = modeLayout?.regions[regionId].activeWidgetId;
  return isPageRegion(regionId) ? [page, mode] : [mode, page];
};

export const restorePageGeometry = (layout: WorkbenchLayout, geometry?: WorkbenchLayout) => {
  if (!geometry) return layout;
  const regions = { ...layout.regions };
  for (const id of [
    "main",
    "bottom",
    "main-left-menu",
    "main-right-menu",
    "bottom-left-menu",
    "bottom-right-menu",
  ] as const) {
    regions[id] = { ...regions[id], size: geometry.regions[id].size };
  }
  return { ...layout, regions };
};
