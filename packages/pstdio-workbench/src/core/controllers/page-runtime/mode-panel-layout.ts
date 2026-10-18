import type { WorkbenchLayout } from "../../registries/layout/layout-types";
import { getWorkbenchModePanelForRegion } from "../../registries/modes/mode-layout";

export const restoreModePanelLayout = (
  layout: WorkbenchLayout,
  saved: WorkbenchLayout | undefined,
  defaults: WorkbenchLayout,
) => {
  const regions = { ...layout.regions };
  for (const region of Object.values(layout.regions)) {
    if (!getWorkbenchModePanelForRegion(region.id)) continue;
    const currentPage = region.widgets.filter((widget) => widget.placementIdentity?.kind === "page");
    const restored = saved?.regions[region.id] ?? defaults.regions[region.id];
    regions[region.id] = {
      ...restored,
      savedWidgetOrder: region.id === "main" ? region.savedWidgetOrder : restored.savedWidgetOrder,
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
