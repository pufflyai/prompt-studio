import type { WorkbenchWidgetPlacement } from "../../core";
import { placementIdentityKey } from "../../core/registries/layout/placement-reconciliation";

export const retainViewPlacements = (
  previous: WorkbenchWidgetPlacement[],
  current: WorkbenchWidgetPlacement[],
  registeredViews: ReadonlySet<string>,
  openPlacements?: ReadonlySet<string>,
) => {
  const retained = new Map(
    previous
      .filter(
        (placement) =>
          placement.viewId &&
          registeredViews.has(placement.viewId) &&
          (!openPlacements || openPlacements.has(placement.widgetId)),
      )
      .map((placement) => [placement.widgetId, placement]),
  );
  for (const placement of current) {
    const existing = previous.find((entry) => entry.widgetId === placement.widgetId);
    const unchanged =
      existing &&
      Object.keys(existing).length === Object.keys(placement).length &&
      Object.entries(placement).every(([key, value]) => {
        const previousValue = Reflect.get(existing, key);
        if (previousValue === value) return true;
        // Navigation recomposes page placements, so an unchanged identity can arrive as a new object.
        return (
          key === "placementIdentity" &&
          previousValue !== undefined &&
          value !== undefined &&
          placementIdentityKey(previousValue) === placementIdentityKey(value)
        );
      });
    retained.set(placement.widgetId, unchanged ? existing : placement);
  }
  const next = [...retained.values()];
  return next.length === previous.length && next.every((placement, index) => placement === previous[index])
    ? previous
    : next;
};
