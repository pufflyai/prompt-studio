import { dashboardGeometry } from "@/theme/primitives/dashboard";
import type { DashboardLayoutMode, DashboardWidget, GridPlacement } from "./dashboard-fixtures";

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, Math.round(value)));
const intersects = (a: GridPlacement, b: GridPlacement) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
export const readingOrder = (widgets: DashboardWidget[]) =>
  [...widgets].sort((a, b) => a.layout.y - b.layout.y || a.layout.x - b.layout.x);

export function compactWidgets(widgets: DashboardWidget[], mode: DashboardLayoutMode = "vertical") {
  if (mode === "free") return readingOrder(widgets);
  const ordered =
    mode === "vertical"
      ? readingOrder(widgets)
      : [...widgets].sort((a, b) => a.layout.x - b.layout.x || a.layout.y - b.layout.y);
  const placed: DashboardWidget[] = [];
  for (const widget of ordered) {
    const layout = { ...widget.layout };
    if (mode === "vertical") layout.y = 0;
    else layout.x = 0;
    let collisions = placed.filter((other) => intersects(layout, other.layout));
    while (collisions.length) {
      if (mode === "vertical") layout.y = Math.max(...collisions.map((other) => other.layout.y + other.layout.h));
      else {
        layout.x++;
        if (layout.x + layout.w > dashboardGeometry.columns) {
          layout.x = 0;
          layout.y++;
        }
      }
      collisions = placed.filter((other) => intersects(layout, other.layout));
    }
    placed.push({ ...widget, layout });
  }
  return readingOrder(placed);
}

export const dashboardColumns = (width: number) => {
  if (width < dashboardGeometry.tablet) return 1;
  return width < dashboardGeometry.desktop ? 6 : dashboardGeometry.columns;
};

function packWidgets(widgets: DashboardWidget[], columns: number) {
  const placed: DashboardWidget[] = [];
  for (const widget of widgets) {
    const w = Math.min(columns, Math.max(1, Math.round((widget.layout.w * columns) / dashboardGeometry.columns)));
    const layout = { x: 0, y: 0, w, h: widget.layout.h };
    while (placed.some((other) => intersects(layout, other.layout))) {
      layout.x++;
      if (layout.x + w > columns) {
        layout.x = 0;
        layout.y++;
      }
    }
    placed.push({ ...widget, layout });
  }
  return placed;
}

export const projectWidgets = (widgets: DashboardWidget[], columns: number) =>
  columns === dashboardGeometry.columns ? readingOrder(widgets) : packWidgets(readingOrder(widgets), columns);

function placeWidget(widgets: DashboardWidget[], id: string, candidate: GridPlacement) {
  const widget = widgets.find((item) => item.id === id);
  if (!widget) return widgets;
  const w = clamp(candidate.w, dashboardGeometry.minColumns, dashboardGeometry.columns);
  const layout = {
    x: clamp(candidate.x, 0, dashboardGeometry.columns - w),
    y: Math.max(0, Math.round(candidate.y)),
    w,
    h: Math.max(dashboardGeometry.minRows, Math.round(candidate.h)),
  };
  const placed = [{ ...widget, layout }];
  for (const other of readingOrder(widgets).filter((item) => item.id !== id)) {
    const next = { ...other.layout };
    let collisions = placed.filter((item) => intersects(next, item.layout));
    while (collisions.length) {
      next.y = Math.max(...collisions.map((item) => item.layout.y + item.layout.h));
      collisions = placed.filter((item) => intersects(next, item.layout));
    }
    placed.push({ ...other, layout: next });
  }
  return readingOrder(placed);
}

export function moveWidget(
  widgets: DashboardWidget[],
  id: string,
  candidate: GridPlacement,
  columns: number,
  mode: DashboardLayoutMode = "vertical",
) {
  if (columns === dashboardGeometry.columns) return compactWidgets(placeWidget(widgets, id, candidate), mode);
  // Narrow views reflow one saved layout. Moving there changes reading order without storing a second layout.
  const projected = projectWidgets(widgets, columns);
  const origin = projected.find((widget) => widget.id === id)?.layout;
  if (origin?.x === candidate.x && origin.y === candidate.y) return widgets;
  const ordered = readingOrder(widgets);
  const from = ordered.findIndex((widget) => widget.id === id);
  if (from < 0) return widgets;
  const center = candidate.y + candidate.h / 2;
  const targets = projected.filter((widget) => widget.id !== id);
  const over = targets.reduce<DashboardWidget | undefined>((closest, widget) => {
    const distance = Math.abs(widget.layout.y + widget.layout.h / 2 - center);
    if (!closest || distance < Math.abs(closest.layout.y + closest.layout.h / 2 - center)) return widget;
    return closest;
  }, undefined);
  if (!over) return widgets;
  const to = ordered.findIndex((widget) => widget.id === over.id);
  const [active] = ordered.splice(from, 1);
  ordered.splice(to, 0, active);
  return compactWidgets(packWidgets(ordered, dashboardGeometry.columns), mode);
}

export function resizeWidget(
  widgets: DashboardWidget[],
  id: string,
  size: { w: number; h: number },
  columns: number,
  mode: DashboardLayoutMode = "vertical",
) {
  const widget = widgets.find((item) => item.id === id);
  if (!widget) return widgets;
  const w = columns === 1 ? widget.layout.w : Math.round((size.w * dashboardGeometry.columns) / columns);
  return compactWidgets(placeWidget(widgets, id, { ...widget.layout, w, h: size.h }), mode);
}

export const appendWidget = (
  widgets: DashboardWidget[],
  widget: DashboardWidget,
  mode: DashboardLayoutMode = "vertical",
) =>
  compactWidgets(
    [
      ...widgets,
      {
        ...widget,
        layout: { ...widget.layout, y: Math.max(0, ...widgets.map((item) => item.layout.y + item.layout.h)) },
      },
    ],
    mode,
  );
