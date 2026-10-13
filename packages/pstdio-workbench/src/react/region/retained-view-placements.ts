import type { WorkbenchWidgetPlacement } from "../../core";

export const retainViewPlacements = (
  previous: WorkbenchWidgetPlacement[],
  current: WorkbenchWidgetPlacement[],
  registeredViews: ReadonlySet<string>,
  keepPlacement: (placement: WorkbenchWidgetPlacement) => boolean = () => true,
) => {
  const retained = new Map(
    previous
      .filter((placement) => placement.viewId && registeredViews.has(placement.viewId) && keepPlacement(placement))
      .map((placement) => [placement.widgetId, placement]),
  );
  for (const placement of current) {
    const existing = previous.find((entry) => entry.widgetId === placement.widgetId);
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
