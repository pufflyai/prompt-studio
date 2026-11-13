import { dashboardGeometry } from "@/theme/primitives/dashboard";
import type { DashboardWidget, GridPlacement } from "./dashboard-types";

export interface DropProbe {
  position: { x: number; y: number };
  gapRatio: number;
}

function vacantRowSpans(widgets: DashboardWidget[], id: string, y: number, columns: number) {
  const occupied = widgets
    .filter((widget) => widget.id !== id && widget.layout.y <= y && widget.layout.y + widget.layout.h > y)
    .map(({ layout }) => layout)
    .sort((a, b) => a.x - b.x);
  const spans: { start: number; end: number }[] = [];
  let start = 0;
  for (const layout of [...occupied, { x: columns, w: 0 }]) {
    if (layout.x > start) spans.push({ start, end: layout.x });
    start = Math.max(start, layout.x + layout.w);
  }
  return spans;
}

const fitSpan = (span: { start: number; end: number }, width: number, desiredX: number) =>
  Math.max(span.start, Math.min(span.end - width, Math.round(desiredX)));

export function fitWidgetInRow(
  widgets: DashboardWidget[],
  id: string,
  y: number,
  width: number,
  desiredX: number,
  columns: number,
) {
  return vacantRowSpans(widgets, id, y, columns)
    .filter(({ start, end }) => end - start >= width)
    .map((span) => fitSpan(span, width, desiredX))
    .sort((a, b) => Math.abs(a - desiredX) - Math.abs(b - desiredX))[0];
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
  for (const widget of [...widgets].sort((a, b) => b.layout.y - a.layout.y)) {
    if (
      widget.id === id ||
      probe.position.y < widget.layout.y ||
      probe.position.y > widget.layout.y + widget.layout.h - probe.gapRatio
    )
      continue;
    const span = vacantRowSpans(widgets, id, widget.layout.y, columns).find(
      ({ start, end }) => end - start >= candidate.w && probe.position.x >= start && probe.position.x <= end,
    );
    if (span) return { id: widget.id, x: fitSpan(span, candidate.w, candidate.x) };
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
