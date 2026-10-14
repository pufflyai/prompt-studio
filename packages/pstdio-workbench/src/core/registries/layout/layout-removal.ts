import { removeLocationSubPanelSelection } from "./layout-operations";
import type { WorkbenchLayout, WorkbenchWidgetPlacement } from "./layout-types";

/** Remove tabs and every selection that points at them, including saved owners. */
export const removeLayoutPlacements = (
  layout: WorkbenchLayout,
  remove: (placement: WorkbenchWidgetPlacement) => boolean,
) => {
  const closedPresets = layout.closedPresets?.filter((placement) => !remove(placement));
  if (closedPresets?.length !== layout.closedPresets?.length) layout = { ...layout, closedPresets };
  const removed = new Set(
    Object.values(layout.regions).flatMap((region) =>
      region.widgets.filter(remove).map((placement) => placement.widgetId),
    ),
  );
  if (!removed.size) return layout;
  const regions = { ...layout.regions };
  for (const region of Object.values(regions)) {
    const widgets = region.widgets.filter((placement) => !removed.has(placement.widgetId));
    regions[region.id] = {
      ...region,
      widgets,
      activeWidgetId: widgets.some((p) => p.widgetId === region.activeWidgetId)
        ? region.activeWidgetId
        : widgets[0]?.widgetId,
      savedWidgetOrder: region.savedWidgetOrder?.filter((id) => !removed.has(id)),
    };
  }
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
