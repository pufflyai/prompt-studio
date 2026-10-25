import type { WorkbenchLayout } from "../../registries/layout/layout-types";
import { getWorkbenchModePanelForRegion } from "../../registries/modes/mode-layout";

const nonMainWidgetIds = (saved: WorkbenchLayout | undefined) =>
  new Set(
    Object.values(saved?.regions ?? {}).flatMap((region) =>
      region.id === "main" ? [] : region.widgets.map((widget) => widget.widgetId),
    ),
  );

export const restoreModePanelLayout = (
  layout: WorkbenchLayout,
  saved: WorkbenchLayout | undefined,
  defaults: WorkbenchLayout,
  pageLayout?: WorkbenchLayout,
) => {
  const regions = { ...layout.regions };
  const pageMain = pageLayout?.regions.main ?? defaults.regions.main;
  const savedIds = nonMainWidgetIds(saved);
  for (const region of Object.values(layout.regions)) {
    if (!getWorkbenchModePanelForRegion(region.id)) continue;
    // Main comes from this page's cache. Auxiliary membership and order come
    // from the mode, including tabs that were originally created by a page.
    const currentPage = region.id === "main" ? pageMain.widgets.filter((widget) => !savedIds.has(widget.widgetId)) : [];
    const restored = saved?.regions[region.id] ?? defaults.regions[region.id];
    regions[region.id] = {
      ...restored,
      headerVisible: pageLayout?.regions[region.id].headerVisible,
      savedWidgetOrder:
        region.id === "main"
          ? pageMain.savedWidgetOrder
          : saved?.regions[region.id].widgets.map((widget) => widget.widgetId),
      widgets: [...currentPage, ...(region.id === "main" ? [] : (saved?.regions[region.id].widgets ?? []))],
      activeWidgetId:
        region.id === "main" ? pageMain.activeWidgetId : (restored.activeWidgetId ?? region.activeWidgetId),
    };
  }
  return {
    ...layout,
    arrangement: saved?.arrangement ?? defaults.arrangement,
    regions,
    activeWidgetId:
      saved?.activeWidgetId && savedIds.has(saved.activeWidgetId) ? saved.activeWidgetId : layout.activeWidgetId,
    activeLocationWidgetId:
      saved?.activeLocationWidgetId && savedIds.has(saved.activeLocationWidgetId)
        ? saved.activeLocationWidgetId
        : layout.activeLocationWidgetId,
  };
};
