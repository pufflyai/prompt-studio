import type { WorkbenchLayout } from "../../registries/layout/layout-types";
import { getWorkbenchModePanelForRegion } from "../../registries/modes/mode-layout";

export const restoreModePanelLayout = (
  layout: WorkbenchLayout,
  saved: WorkbenchLayout | undefined,
  defaults: WorkbenchLayout,
  pageLayout = layout,
) => {
  const regions = { ...layout.regions };
  const savedIds = new Set(
    Object.values(saved?.regions ?? {}).flatMap((region) =>
      region.id === "main" ? [] : region.widgets.map((widget) => widget.widgetId),
    ),
  );
  for (const region of Object.values(layout.regions)) {
    if (!getWorkbenchModePanelForRegion(region.id)) continue;
    // Main comes from this page's cache. Auxiliary membership and order come
    // from the mode, including tabs that were originally created by a page.
    const currentPage =
      region.id === "main" ? pageLayout.regions.main.widgets.filter((widget) => !savedIds.has(widget.widgetId)) : [];
    const restored = saved?.regions[region.id] ?? defaults.regions[region.id];
    regions[region.id] = {
      ...restored,
      savedWidgetOrder:
        region.id === "main"
          ? pageLayout.regions.main.savedWidgetOrder
          : saved?.regions[region.id].widgets.map((widget) => widget.widgetId),
      widgets: [...currentPage, ...(region.id === "main" ? [] : (saved?.regions[region.id].widgets ?? []))],
      activeWidgetId:
        region.id === "main"
          ? pageLayout.regions.main.activeWidgetId
          : (restored.activeWidgetId ?? region.activeWidgetId),
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
