import type { WorkbenchWidgetPlacement } from "../../core";

export const retainViewPlacements = (
  previous: WorkbenchWidgetPlacement[],
  current: WorkbenchWidgetPlacement[],
  registeredViews: ReadonlySet<string>,
) => {
  const retained = new Map(
    previous
      .filter((placement) => placement.viewId && registeredViews.has(placement.viewId))
      .map((placement) => [placement.widgetId, placement]),
  );
  for (const placement of current) {
    const existing = retained.get(placement.widgetId);
    const unchanged =
      existing &&
      Object.keys(existing).length === Object.keys(placement).length &&
      Object.entries(placement).every(([key, value]) => Reflect.get(existing, key) === value);
    retained.set(placement.widgetId, unchanged ? existing : placement);
  }
  const next = [...retained.values()];
  return next.length === previous.length && next.every((placement, index) => placement === previous[index])
    ? previous
    : next;
};
