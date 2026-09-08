import { type WorkbenchRegion, workbenchRegions } from "./layout-regions";
import type { WorkbenchLayout, WorkbenchRegionState, WorkbenchWidgetPlacement } from "./layout-types";
import { resolveUniqueWidgetId } from "./widget-id";

const createRegionState = (id: WorkbenchRegion, visible: boolean): WorkbenchRegionState => ({
  id,
  visible,
  widgets: [],
});

export const createDefaultWorkbenchLayout = (
  regionVisibility: Partial<Record<WorkbenchRegion, boolean>> = {},
): WorkbenchLayout => {
  const createRegion = (id: WorkbenchRegion) => createRegionState(id, regionVisibility[id] ?? true);

  return {
    regions: {
      nav: createRegion("nav"),
      activity: createRegion("activity"),
      sidenav: createRegion("sidenav"),
      "main-header": createRegion("main-header"),
      "main-left-menu": createRegion("main-left-menu"),
      main: createRegion("main"),
      "main-right-menu": createRegion("main-right-menu"),
      "secondary-header": createRegion("secondary-header"),
      "secondary-left-menu": createRegion("secondary-left-menu"),
      secondary: createRegion("secondary"),
      "secondary-right-menu": createRegion("secondary-right-menu"),
      "side-header": createRegion("side-header"),
      "side-left-menu": createRegion("side-left-menu"),
      side: createRegion("side"),
      "side-right-menu": createRegion("side-right-menu"),
      status: createRegion("status"),
      overlay: createRegion("overlay"),
    },
  };
};

const findLastWidgetIndex = (widgets: WorkbenchWidgetPlacement[], widgetId: string) => {
  for (let index = widgets.length - 1; index >= 0; index -= 1) {
    if (widgets[index]?.widgetId === widgetId) return index;
  }
  return -1;
};

const normalizeWidgetIds = (layout: WorkbenchLayout) => {
  const widgetIds = new Set<string>();
  const regions = {} as WorkbenchLayout["regions"];
  let activeWidgetId = layout.activeWidgetId;
  let activeResourceKey = layout.activeResourceKey;

  for (const [id, region] of Object.entries(layout.regions) as [WorkbenchRegion, WorkbenchRegionState][]) {
    const originalActiveWidgetId = region.activeWidgetId;
    const activeIndex = originalActiveWidgetId ? findLastWidgetIndex(region.widgets, originalActiveWidgetId) : -1;
    const widgets = region.widgets.map((placement) => {
      const widgetId = resolveUniqueWidgetId(widgetIds, placement.contributionId, placement.widgetId);
      widgetIds.add(widgetId);
      return widgetId === placement.widgetId ? placement : { ...placement, widgetId };
    });
    const normalizedActiveWidgetId = activeIndex >= 0 ? widgets[activeIndex]?.widgetId : originalActiveWidgetId;
    regions[id] = { ...region, widgets, activeWidgetId: normalizedActiveWidgetId };

    if (originalActiveWidgetId && layout.activeWidgetId === originalActiveWidgetId && activeIndex >= 0) {
      activeWidgetId = normalizedActiveWidgetId;
      activeResourceKey = widgets[activeIndex]?.resourceKey;
    }
  }

  return { ...layout, regions, activeWidgetId, activeResourceKey };
};

export const mergeWithDefaultRegions = (
  persisted: WorkbenchLayout,
  regionVisibility: Partial<Record<WorkbenchRegion, boolean>> = {},
): WorkbenchLayout => {
  const defaults = createDefaultWorkbenchLayout(regionVisibility);
  const persistedRegions = Object.fromEntries(
    workbenchRegions.flatMap((region) => (persisted.regions[region] ? [[region, persisted.regions[region]]] : [])),
  ) as Partial<WorkbenchLayout["regions"]>;
  return normalizeWidgetIds({
    ...persisted,
    regions: { ...defaults.regions, ...persistedRegions },
  });
};
