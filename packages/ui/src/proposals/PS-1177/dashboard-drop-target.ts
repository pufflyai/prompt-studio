import { dashboardGeometry } from "@/theme/primitives/dashboard";
import type { DashboardWidget } from "./dashboard-fixtures";

export interface DropProbe {
  position: { x: number; y: number };
  gapRatio: number;
}

export function findRowGap(widgets: DashboardWidget[], probe: DropProbe) {
  const rows = new Map<number, DashboardWidget[]>();
  for (const widget of widgets) {
    const row = rows.get(widget.layout.y) ?? [];
    row.push(widget);
    rows.set(widget.layout.y, row);
  }
  const ordered = [...rows].sort(([a], [b]) => a - b);
  const gaps: { y: number; beforeId: string | null }[] = [];
  let occupiedUntil = 0;
  for (const [y, row] of ordered) {
    if (y >= occupiedUntil) gaps.push({ y, beforeId: row[0].id });
    occupiedUntil = Math.max(occupiedUntil, ...row.map(({ layout }) => layout.y + layout.h));
  }
  gaps.push({ y: occupiedUntil, beforeId: null });
  return gaps.find(
    ({ y }) => Math.abs(probe.position.y - (y - probe.gapRatio / 2)) <= dashboardGeometry.rowDropProximity,
  );
}
