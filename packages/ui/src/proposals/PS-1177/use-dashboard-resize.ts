import { type KeyboardEvent, type RefObject, type SyntheticEvent, useState } from "react";
import type { ResizeCallbackData } from "react-resizable";
import { dashboardGeometry } from "@/theme/primitives/dashboard";
import type { DashboardLayoutMode, DashboardResizeHandle, DashboardWidget, GridPlacement } from "./dashboard-fixtures";
import { measureGrid, placementSize } from "./dashboard-grid-geometry";
import { resizeWidget } from "./dashboard-layout";

type GridMetrics = ReturnType<typeof measureGrid>;
interface ResizeSession {
  id: string;
  metrics: GridMetrics;
  size: { w: number; h: number };
  origin: GridPlacement;
  handle: DashboardResizeHandle;
}
interface ResizeOptions {
  widgets: DashboardWidget[];
  projected: DashboardWidget[];
  columns: number;
  mode: DashboardLayoutMode;
  grid: RefObject<HTMLDivElement | null>;
  onChange: (widgets: DashboardWidget[]) => void;
  onGestureStart: () => void;
}

const gridSize = (size: ResizeCallbackData["size"], metrics: GridMetrics) => ({
  w: Math.max(1, Math.round((size.width * metrics.scale + metrics.gap) / metrics.column)),
  h: Math.max(dashboardGeometry.minRows, Math.round((size.height * metrics.scale + metrics.gap) / metrics.row)),
});

export function useDashboardResize(options: ResizeOptions) {
  const { widgets, projected, columns, mode, grid, onChange, onGestureStart } = options;
  const [resize, setResize] = useState<ResizeSession | null>(null);
  const resizableProps = (widget: DashboardWidget, geometry: GridMetrics) => {
    const session = resize?.id === widget.id ? resize : null;
    const metrics = session?.metrics ?? geometry;
    const min = placementSize(
      {
        w: Math.max(1, Math.round((dashboardGeometry.minColumns * columns) / dashboardGeometry.columns)),
        h: dashboardGeometry.minRows,
      },
      metrics,
    );
    let maxColumns = columns;
    if (session) {
      maxColumns = session.handle.endsWith("w") ? session.origin.x + session.origin.w : columns - session.origin.x;
    }
    const max = placementSize({ w: maxColumns, h: Infinity }, metrics);
    return {
      ...placementSize(widget.layout, metrics),
      transformScale: metrics.scale,
      minConstraints: [min.width, min.height] as [number, number],
      maxConstraints: [max.width, max.height] as [number, number],
      onResizeStart: (event: SyntheticEvent, data: ResizeCallbackData) => {
        if (!grid.current) return;
        event.stopPropagation();
        onGestureStart();
        setResize({
          id: widget.id,
          metrics: measureGrid(grid.current, columns),
          size: { w: widget.layout.w, h: widget.layout.h },
          origin: widget.layout,
          handle: data.handle as DashboardResizeHandle,
        });
      },
      onResize: (_event: SyntheticEvent, data: ResizeCallbackData) => {
        if (resize?.id === widget.id) setResize({ ...resize, size: gridSize(data.size, resize.metrics) });
      },
      onResizeStop: (_event: SyntheticEvent, data: ResizeCallbackData) => {
        if (resize?.id !== widget.id) return;
        onChange(resizeWidget(widgets, widget.id, gridSize(data.size, resize.metrics), columns, mode, resize.handle));
        setResize(null);
      },
    };
  };
  const onHandleKeyDown = (id: string, handle: DashboardResizeHandle, event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Escape") {
      setResize(null);
      return;
    }
    const directions: Record<string, { w: number; h: number }> = {
      ArrowLeft: { w: -1, h: 0 },
      ArrowRight: { w: 1, h: 0 },
      ArrowUp: { w: 0, h: -1 },
      ArrowDown: { w: 0, h: 1 },
    };
    const delta = directions[event.key];
    const widget = projected.find((item) => item.id === id);
    if (!delta || !widget) return;
    event.preventDefault();
    event.stopPropagation();
    const widthDelta = handle.endsWith("w") ? -delta.w : delta.w;
    onChange(
      resizeWidget(
        widgets,
        id,
        { w: widget.layout.w + widthDelta, h: widget.layout.h + delta.h },
        columns,
        mode,
        handle,
      ),
    );
  };
  return { resize, resizableProps, onHandleKeyDown, cancel: () => setResize(null) };
}
