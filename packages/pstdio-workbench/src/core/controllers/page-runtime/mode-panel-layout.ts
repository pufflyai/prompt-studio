import type { WorkbenchLayout } from "../../registries/layout/layout-types";
import { getWorkbenchModePanelForRegion } from "../../registries/modes/mode-layout";

export const restoreModePanelLayout = (
  layout: WorkbenchLayout,
  saved: WorkbenchLayout | undefined,
  defaults: WorkbenchLayout,
  pageLayout = layout,
) => {
  const regions = { ...layout.regions };
  for (const region of Object.values(layout.regions)) {
    if (!getWorkbenchModePanelForRegion(region.id)) continue;
    // Carried mode regions can replace a page's cached region. Restore that
    // page's placements separately so their chosen destinations survive.
    const currentPage = pageLayout.regions[region.id].widgets.filter(
      (widget) => widget.placementIdentity?.kind === "page",
    );
    const restored = saved?.regions[region.id] ?? defaults.regions[region.id];
    regions[region.id] = {
      ...restored,
      savedWidgetOrder: pageLayout.regions[region.id].savedWidgetOrder,
      widgets: [...currentPage, ...(saved?.regions[region.id].widgets ?? [])],
      activeWidgetId: restored.activeWidgetId ?? region.activeWidgetId,
    };
  }
  const savedIds = new Set(
    Object.values(saved?.regions ?? {}).flatMap((region) => region.widgets.map((widget) => widget.widgetId)),
  );
  return {
    ...layout,
    regions,
    activeWidgetId:
      saved?.activeWidgetId && savedIds.has(saved.activeWidgetId) ? saved.activeWidgetId : layout.activeWidgetId,
    activeLocationWidgetId:
      saved?.activeLocationWidgetId && savedIds.has(saved.activeLocationWidgetId)
        ? saved.activeLocationWidgetId
        : layout.activeLocationWidgetId,
  };
};
