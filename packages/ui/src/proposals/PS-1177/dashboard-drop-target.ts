import { dashboardGeometry } from "@/theme/primitives/dashboard";
import type { DashboardWidget, GridPlacement } from "./dashboard-fixtures";

export interface DropProbe {
  position: { x: number; y: number };
  gapRatio: number;
}

export function fitWidgetInRow(
  widgets: DashboardWidget[],
  id: string,
  y: number,
  width: number,
  pointerX: number,
  desiredX: number,
  columns: number,
) {
  const occupied = widgets
    .filter((widget) => widget.id !== id && widget.layout.y <= y && widget.layout.y + widget.layout.h > y)
    .map(({ layout }) => layout)
    .sort((a, b) => a.x - b.x);
  let start = 0;
  for (const layout of [...occupied, { x: columns, w: 0 }]) {
    const end = layout.x;
    if (end - start >= width && pointerX >= start && pointerX <= end)
      return Math.max(start, Math.min(end - width, Math.round(desiredX)));
    start = Math.max(start, end + layout.w);
  }
}

export function findRowVacancy(
  widgets: DashboardWidget[],
  id: string,
  candidate: GridPlacement,
  columns: number,
  probe: DropProbe,
) {
  if (probe.position.x < 0 || probe.position.x > columns) return;
  const occupied = widgets.some(
    ({ id: otherId, layout }) =>
      otherId !== id &&
      probe.position.x >= layout.x &&
      probe.position.x < layout.x + layout.w &&
      probe.position.y >= layout.y &&
      probe.position.y < layout.y + layout.h - probe.gapRatio,
  );
  if (occupied) return;
  for (const widget of widgets) {
    if (
      widget.id === id ||
      probe.position.y < widget.layout.y ||
      probe.position.y > widget.layout.y + widget.layout.h - probe.gapRatio
    )
      continue;
    const x = fitWidgetInRow(widgets, id, widget.layout.y, candidate.w, probe.position.x, candidate.x, columns);
    if (x !== undefined) return { id: widget.id, x };
  }
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
