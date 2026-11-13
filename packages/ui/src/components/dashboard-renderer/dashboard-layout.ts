import { dashboardGeometry } from "@/theme/primitives/dashboard";
import { type DropProbe, findRowGap, findRowVacancy, fitWidgetInRow } from "./dashboard-drop-target";
import { placementsIntersect as intersects } from "./dashboard-grid-geometry";
import { insertWidgetRow, swapWithinRow } from "./dashboard-rows";
import type { DashboardLayoutMode, DashboardResizeHandle, DashboardWidget, GridPlacement } from "./dashboard-types";

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, Math.round(value)));
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

function settleWidgets(widgets: DashboardWidget[]) {
  const placed: DashboardWidget[] = [];
  for (const widget of widgets) {
    const next = { ...widget.layout };
    let collisions = placed.filter((item) => intersects(next, item.layout));
    while (collisions.length) {
      next.y = Math.max(...collisions.map((item) => item.layout.y + item.layout.h));
      collisions = placed.filter((item) => intersects(next, item.layout));
    }
    placed.push({ ...widget, layout: next });
  }
  return readingOrder(placed);
}

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
  return settleWidgets([{ ...widget, layout }, ...readingOrder(widgets).filter((item) => item.id !== id)]);
}

function previewRowSwap(
  widgets: DashboardWidget[],
  active: DashboardWidget,
  target: DashboardWidget,
  mode: DashboardLayoutMode,
) {
  const swapped = swapWithinRow(widgets, active, target);
  return swapped === widgets
    ? { type: "none" as const, widgets }
    : { type: "widget" as const, widgets: compactWidgets(swapped, mode) };
}

export function previewWidgetMove(
  widgets: DashboardWidget[],
  id: string,
  candidate: GridPlacement,
  columns: number,
  mode: DashboardLayoutMode = "vertical",
  probe: DropProbe = {
    position: { x: candidate.x + candidate.w / 2, y: candidate.y + candidate.h / 2 },
    gapRatio: 1 / 3,
  },
) {
  const projected = projectWidgets(widgets, columns);
  const active = widgets.find((widget) => widget.id === id);
  const origin = projected.find((widget) => widget.id === id)?.layout;
  const unchanged = { type: "none" as const, widgets };
  if (!active || !origin || (origin.x === candidate.x && origin.y === candidate.y)) return unchanged;
  const x = clamp(candidate.x, 0, columns - candidate.w);
  const layout = { ...candidate, x, y: Math.max(0, candidate.y) };
  const vertical = origin.y !== layout.y;
  const gap =
    vertical && probe.position.x >= 0 && probe.position.x <= columns ? findRowGap(projected, probe) : undefined;
  if (gap)
    return {
      type: "row" as const,
      widgets: compactWidgets(insertWidgetRow(widgets, active, gap.beforeId), mode),
      gap,
    };
  const vacancy = vertical ? findRowVacancy(projected, id, layout, columns, probe) : undefined;
  const row = widgets.find((widget) => widget.id === vacancy?.id);
  if (vacancy && row) {
    // Responsive packing can move columns; the saved row still needs enough contiguous width.
    const savedX = fitWidgetInRow(
      widgets,
      id,
      row.layout.y,
      active.layout.w,
      (vacancy.x * dashboardGeometry.columns) / columns,
      dashboardGeometry.columns,
    );
    if (savedX !== undefined) {
      const joined = placeWidget(widgets, id, { ...active.layout, x: savedX, y: row.layout.y });
      return { type: "widget" as const, widgets: compactWidgets(joined, mode) };
    }
  }
  if (vertical && mode !== "free") return unchanged;
  const collisions = projected.filter((widget) => widget.id !== id && intersects(layout, widget.layout));
  if (vertical && collisions.length) return unchanged;
  const over = collisions
    .filter((widget) => widget.layout.y === origin.y)
    .sort((a, b) => {
      const overlap = (other: GridPlacement) => Math.min(x + candidate.w, other.x + other.w) - Math.max(x, other.x);
      return overlap(b.layout) - overlap(a.layout);
    })[0];
  const target = widgets.find((widget) => widget.id === over?.id);
  if (target && active.layout.y === target.layout.y) {
    return previewRowSwap(widgets, active, target, mode);
  }
  if (columns === dashboardGeometry.columns && !collisions.length) {
    return { type: "widget" as const, widgets: compactWidgets(placeWidget(widgets, id, candidate), mode) };
  }
  return unchanged;
}

export function moveWidget(
  widgets: DashboardWidget[],
  id: string,
  candidate: GridPlacement,
  columns: number,
  mode: DashboardLayoutMode = "vertical",
  probe?: DropProbe,
) {
  return previewWidgetMove(widgets, id, candidate, columns, mode, probe).widgets;
}

export function resizeWidget(
  widgets: DashboardWidget[],
  id: string,
  size: { w: number; h: number },
  columns: number,
  mode: DashboardLayoutMode = "vertical",
  handle: DashboardResizeHandle = "se",
) {
  const widget = widgets.find((item) => item.id === id);
  if (!widget) return widgets;
  const { layout } = widget;
  const fromLeft = handle.endsWith("w") && columns > 1;
  const maxWidth = fromLeft ? layout.x + layout.w : dashboardGeometry.columns - layout.x;
  const projectedWidth = projectWidgets(widgets, columns).find((item) => item.id === id)!.layout.w;
  const requestedWidth = layout.w + Math.round(((size.w - projectedWidth) * dashboardGeometry.columns) / columns);
  const w = columns === 1 || handle === "s" ? layout.w : clamp(requestedWidth, dashboardGeometry.minColumns, maxWidth);
  const x = fromLeft ? layout.x + layout.w - w : layout.x;
  const h = handle === "e" || handle === "w" ? layout.h : size.h;
  return compactWidgets(placeWidget(widgets, id, { ...layout, x, w, h }), mode);
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
