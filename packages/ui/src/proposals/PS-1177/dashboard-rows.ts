import type { DashboardLayoutMode, DashboardWidget } from "./dashboard-fixtures";

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
  return widgets.map((widget) => {
    const nextX = placements.get(widget.id);
    return nextX === undefined ? widget : { ...widget, layout: { ...widget.layout, x: nextX } };
  });
}

export function swapRows(
  widgets: DashboardWidget[],
  active: DashboardWidget,
  target: DashboardWidget,
  mode: DashboardLayoutMode,
) {
  // Use saved rows so responsive projections keep the same widgets together during a swap.
  const groups = new Map<number, DashboardWidget[]>();
  for (const widget of widgets) {
    const row = groups.get(widget.layout.y) ?? [];
    row.push(widget);
    groups.set(widget.layout.y, row);
  }
  const rows = [...groups]
    .sort(([a], [b]) => a - b)
    .map(([y, widgets]) => ({
      y,
      widgets,
      height: Math.max(...widgets.map(({ layout }) => layout.h)),
    }));
  const gaps = rows.map((row, index) => Math.max(0, (rows[index + 1]?.y ?? 0) - row.y - row.height));
  const from = rows.findIndex(({ y }) => y === active.layout.y);
  const to = rows.findIndex(({ y }) => y === target.layout.y);
  const movingIds = rows[from].widgets.map(({ id }) => id);
  let y = mode === "vertical" ? 0 : rows[0].y;
  [rows[from], rows[to]] = [rows[to], rows[from]];
  const result = rows.flatMap((row, index) => {
    const next = row.widgets.map((widget) => ({ ...widget, layout: { ...widget.layout, y } }));
    y += row.height + (mode === "vertical" ? 0 : gaps[index]);
    return next;
  });
  return { widgets: result, movingIds };
}
