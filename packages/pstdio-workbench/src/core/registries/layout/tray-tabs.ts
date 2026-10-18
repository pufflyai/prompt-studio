import type { WorkbenchTabPosition, WorkbenchWidgetPlacement } from "./layout-types";

// The incoming preview wins. Restored trays keep their selected preview, or the first one.
export const planTrayTabs = (widgets: readonly WorkbenchWidgetPlacement[], preferredWidgetId?: string) => {
  const previews = widgets.filter((widget) => widget.tabRetention === "preview");
  const preview = previews.find((widget) => widget.widgetId === preferredWidgetId) ?? previews[0];
  return {
    widgets: [...(preview ? [preview] : []), ...widgets.filter((widget) => widget.tabRetention !== "preview")],
    replaced: previews.filter((widget) => widget !== preview),
  };
};

export const planTrayDrop = (
  widgets: readonly WorkbenchWidgetPlacement[],
  placement: WorkbenchWidgetPlacement,
  position: WorkbenchTabPosition = "end",
) => {
  const remaining = widgets.filter((widget) => widget.widgetId !== placement.widgetId);
  let index = position === "start" ? 0 : remaining.length;
  if (typeof position === "object") {
    const before = "beforeWidgetId" in position;
    const target = before ? position.beforeWidgetId : position.afterWidgetId;
    const found = remaining.findIndex((widget) => widget.widgetId === target);
    if (found >= 0) index = found + (before ? 0 : 1);
  }
  remaining.splice(index, 0, placement);
  return planTrayTabs(remaining, placement.tabRetention === "preview" ? placement.widgetId : undefined);
};
