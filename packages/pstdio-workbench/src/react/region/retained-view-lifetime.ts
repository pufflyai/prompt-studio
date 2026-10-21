import { SESSION_RESOURCE_RETENTION_MS } from "pstdio-api-contracts";
import type { WorkbenchWidgetPlacement } from "../../core";
import { retainViewPlacements } from "./retained-view-placements";

export interface RetainedViewState {
  placements: WorkbenchWidgetPlacement[];
  expires: ReadonlyMap<string, number>;
}

export const retainRecentViewPlacements = (
  previous: RetainedViewState,
  current: WorkbenchWidgetPlacement[],
  registered: ReadonlySet<string>,
  open: ReadonlySet<string> | undefined,
  now: number,
) => {
  const expires = new Map<string, number>();
  const retained = open ? new Set(open) : undefined;
  const currentIds = new Set(current.map((placement) => placement.widgetId));
  for (const placement of previous.placements) {
    if (!placement.viewId || !registered.has(placement.viewId)) continue;
    const id = placement.widgetId;
    if (!retained || open?.has(id) || currentIds.has(id)) continue;
    const deadline = previous.expires.get(id) ?? now + SESSION_RESOURCE_RETENTION_MS;
    if (deadline <= now) continue;
    expires.set(id, deadline);
    retained.add(id);
  }
  const placements = retainViewPlacements(previous.placements, current, registered, retained);
  const unchanged =
    expires.size === previous.expires.size && [...expires].every(([id, at]) => previous.expires.get(id) === at);
  return placements === previous.placements && unchanged ? previous : { placements, expires };
};
