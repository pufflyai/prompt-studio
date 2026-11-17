import { placementsIntersect } from "./dashboard-grid-geometry";
import type { DashboardWidget } from "./dashboard-types";

export function swapWithinRow(widgets: DashboardWidget[], active: DashboardWidget, target: DashboardWidget) {
  const row = widgets.filter(({ layout }) => layout.y === active.layout.y).sort((a, b) => a.layout.x - b.layout.x);
  const gaps = row.map((widget, index) =>
    Math.max(0, (row[index + 1]?.layout.x ?? 0) - widget.layout.x - widget.layout.w),
  );
  let x = row[0].layout.x;
  const from = row.findIndex(({ id }) => id === active.id);
  const to = row.findIndex(({ id }) => id === target.id);
  [row[from], row[to]] = [row[to], row[from]];
  const placements = new Map<string, number>();
  row.forEach((widget, index) => {
    placements.set(widget.id, x);
    x += widget.layout.w + gaps[index];
  });
  const swapped = widgets.map((widget) => {
    const nextX = placements.get(widget.id);
    return nextX === undefined ? widget : { ...widget, layout: { ...widget.layout, x: nextX } };
  });
  const overlaps = swapped.some((widget, index) =>
    swapped.slice(index + 1).some((other) => placementsIntersect(widget.layout, other.layout)),
  );
  return overlaps ? widgets : swapped;
}

export function insertWidgetRow(widgets: DashboardWidget[], active: DashboardWidget, beforeId: string | null) {
  const ordered = [...widgets].sort((a, b) => a.layout.y - b.layout.y || a.layout.x - b.layout.x);
  const boundary =
    widgets.find(({ id }) => id === beforeId)?.layout.y ??
    Math.max(0, ...widgets.map(({ layout }) => layout.y + layout.h));
  if (beforeId === active.id) {
    beforeId = ordered[ordered.findIndex(({ id }) => id === active.id) + 1]?.id ?? null;
  }
  const remaining = ordered.filter(({ id }) => id !== active.id);
  const index = remaining.findIndex(({ id }) => id === beforeId);
  const split = index < 0 ? remaining.length : index;
  const prefix = remaining.slice(0, split);
  const suffix = remaining.slice(split);
  const targetY = suffix[0]?.layout.y ?? boundary;
  // Keep staggered offsets on either side. A narrow-layout split must clear all preceding cards.
  const y = Math.max(targetY, 0, ...prefix.map((widget) => widget.layout.y + widget.layout.h));
  const shift = y + active.layout.h - targetY;
  return [
    ...prefix,
    { ...active, layout: { ...active.layout, y } },
    ...suffix.map((widget) => ({ ...widget, layout: { ...widget.layout, y: widget.layout.y + shift } })),
  ];
}
