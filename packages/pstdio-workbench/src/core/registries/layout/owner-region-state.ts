import type { WorkbenchLayout, WorkbenchRegion, WorkbenchRegionSettings } from "./layout-types";
import { defaultPageLayout, enforceFixedGeometry } from "./panel-geometry";

export const isPageRegion = (region: WorkbenchRegion) =>
  region === "main" ||
  region.startsWith("main-") ||
  region === "bottom" ||
  region.startsWith("bottom-") ||
  region === "aside" ||
  region.startsWith("aside-");

export const restoreOwnerRegion = (
  layout: WorkbenchLayout,
  regionId: WorkbenchRegion,
  modeLayout?: WorkbenchLayout,
) => {
  const region = layout.regions[regionId];
  const shared = !isPageRegion(regionId) ? modeLayout?.regions[regionId] : undefined;
  if (!shared) return region;
  return {
    ...region,
    size: shared.size,
    visible: shared.visible,
    visibility: shared.visibility,
    headerVisible: shared.headerVisible,
    presentation: shared.presentation,
  };
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

export const restorePageGeometry = (
  layout: WorkbenchLayout,
  geometry?: WorkbenchLayout,
  settings?: Partial<Record<"aside" | "bottom", WorkbenchRegionSettings>>,
) => {
  if (!geometry && !settings) return layout;
  const regions = { ...layout.regions };
  for (const id of [
    "main",
    "bottom",
    "aside",
    "aside-left-menu",
    "aside-right-menu",
    "main-left-menu",
    "main-right-menu",
    "bottom-left-menu",
    "bottom-right-menu",
  ] as const) {
    if (geometry) regions[id] = { ...regions[id], size: geometry.regions[id].size };
  }
  const defaults = { ...layout, regions, pageLayout: defaultPageLayout(settings?.aside?.edge, settings?.bottom?.edge) };
  return enforceFixedGeometry(
    { ...defaults, pageLayout: geometry?.pageLayout ?? defaults.pageLayout },
    defaults,
    ["aside", "bottom"],
    (panel) => settings?.[panel as "aside" | "bottom"]?.movable !== false,
  );
};

export const restoreAdoptedModeGeometry = (
  layout: WorkbenchLayout,
  previous: WorkbenchLayout,
  adoptedRegions: readonly WorkbenchRegion[],
  activatedRegions: readonly WorkbenchRegion[],
) => {
  if (!adoptedRegions.length) return layout;
  const regions = { ...layout.regions };
  for (const id of new Set(adoptedRegions)) {
    const region = restoreOwnerRegion(layout, id, previous);
    const selected = previous.regions[id].activeWidgetId;
    regions[id] = {
      ...region,
      activeWidgetId:
        !activatedRegions.includes(id) && region.widgets.some((p) => p.widgetId === selected)
          ? selected
          : region.activeWidgetId,
    };
  }
  return { ...layout, regions };
};
