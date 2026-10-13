import { removeLocationSubPanelSelection } from "./layout-operations";
import type { WorkbenchLayout, WorkbenchWidgetPlacement } from "./layout-types";

/** Remove tabs and every selection that points at them, including saved owners. */
export const removeLayoutPlacements = (
  layout: WorkbenchLayout,
  remove: (placement: WorkbenchWidgetPlacement) => boolean,
) => {
  const removed = new Set<string>();
  const regions = { ...layout.regions };
  for (const region of Object.values(regions)) {
    const widgets = region.widgets.filter((placement) => {
      if (!remove(placement)) return true;
      removed.add(placement.widgetId);
      return false;
    });
    regions[region.id] = {
      ...region,
      widgets,
      activeWidgetId: widgets.some((p) => p.widgetId === region.activeWidgetId)
        ? region.activeWidgetId
        : widgets[0]?.widgetId,
      savedWidgetOrder: region.savedWidgetOrder?.filter((id) => widgets.some((p) => p.widgetId === id)),
    };
  }
  if (!removed.size) return layout;
  let next = { ...layout, regions };
  for (const id of removed) next = removeLocationSubPanelSelection(next, id);
  const remaining = Object.values(regions).flatMap((region) => region.widgets);
  const location =
    remaining.find((p) => p.widgetId === layout.activeLocationWidgetId) ?? remaining.find((p) => p.role === "location");
  const active = remaining.find((p) => p.widgetId === layout.activeWidgetId) ?? location ?? remaining[0];
  return {
    ...next,
    activeWidgetId: active?.widgetId,
    activeLocationWidgetId: location?.widgetId,
    activeResourceKey: active?.resourceKey,
  };
};
