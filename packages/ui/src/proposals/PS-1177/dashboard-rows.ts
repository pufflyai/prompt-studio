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

export function insertWidgetRow(
  widgets: DashboardWidget[],
  active: DashboardWidget,
  beforeId: string | null,
  mode: DashboardLayoutMode,
) {
  // Remove only the active widget; a narrow-layout gap may split its saved row.
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
      widgets: widgets.sort((a, b) => a.layout.x - b.layout.x),
      height: Math.max(...widgets.map(({ layout }) => layout.h)),
    }));
  const remaining = rows
    .map((row, index) => ({
      widgets: row.widgets.filter(({ id }) => id !== active.id),
      gap: index === 0 ? row.y : Math.max(0, row.y - rows[index - 1].y - rows[index - 1].height),
    }))
    .filter(({ widgets }) => widgets.length > 0);
  if (beforeId === active.id) {
    const ordered = rows.flatMap(({ widgets }) => widgets);
    beforeId = ordered[ordered.findIndex(({ id }) => id === active.id) + 1]?.id ?? null;
  }
  const targetIndex = remaining.findIndex(({ widgets }) => widgets.some(({ id }) => id === beforeId));
  if (targetIndex < 0) remaining.push({ widgets: [active], gap: 0 });
  else {
    const target = remaining[targetIndex];
    const split = target.widgets.findIndex(({ id }) => id === beforeId);
    const before = target.widgets.slice(0, split);
    const after = target.widgets.slice(split);
    const insertion = [
      { widgets: [active], gap: before.length ? 0 : target.gap },
      { widgets: after, gap: 0 },
    ];
    if (before.length) insertion.unshift({ widgets: before, gap: target.gap });
    remaining.splice(targetIndex, 1, ...insertion);
  }
  let y = 0;
  return remaining.flatMap((row) => {
    if (mode !== "vertical") y += row.gap;
    const next = row.widgets.map((widget) => ({ ...widget, layout: { ...widget.layout, y } }));
    y += Math.max(...row.widgets.map(({ layout }) => layout.h));
    return next;
  });
}
