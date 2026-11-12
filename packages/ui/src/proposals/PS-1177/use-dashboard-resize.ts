import { type KeyboardEvent, type PointerEvent, type RefObject, useState } from "react";
import type { DashboardWidget, GridPlacement } from "./dashboard-fixtures";
import { measureGrid } from "./dashboard-grid-geometry";
import { resizeWidget } from "./dashboard-layout";

interface ResizeSession {
  id: string;
  start: { x: number; y: number };
  origin: GridPlacement;
  metrics: { column: number; row: number };
  size: { w: number; h: number };
}
interface ResizeOptions {
  widgets: DashboardWidget[];
  projected: DashboardWidget[];
  columns: number;
  grid: RefObject<HTMLDivElement | null>;
  onChange: (widgets: DashboardWidget[]) => void;
  onGestureStart: () => void;
}

export function useDashboardResize(options: ResizeOptions) {
  const { widgets, projected, columns, grid, onChange, onGestureStart } = options;
  const [resize, setResize] = useState<ResizeSession | null>(null);
  const handlers = (id: string) => ({
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0 || !grid.current) return;
      event.preventDefault();
      event.stopPropagation();
      const widget = projected.find((item) => item.id === id);
      if (!widget) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      onGestureStart();
      setResize({
        id,
        origin: widget.layout,
        start: { x: event.clientX, y: event.clientY },
        metrics: measureGrid(grid.current, columns),
        size: { w: widget.layout.w, h: widget.layout.h },
      });
    },
    onPointerMove: (event: PointerEvent<HTMLButtonElement>) => {
      if (!resize) return;
      setResize({
        ...resize,
        size: {
          w: Math.max(
            1,
            Math.min(columns, resize.origin.w + Math.round((event.clientX - resize.start.x) / resize.metrics.column)),
          ),
          h: Math.max(3, resize.origin.h + Math.round((event.clientY - resize.start.y) / resize.metrics.row)),
        },
      });
    },
    onPointerUp: (event: PointerEvent<HTMLButtonElement>) => {
      if (!resize) return;
      onChange(resizeWidget(widgets, id, resize.size, columns));
      setResize(null);
      event.currentTarget.releasePointerCapture(event.pointerId);
    },
    onPointerCancel: () => setResize(null),
    onLostPointerCapture: () => setResize(null),
    onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => {
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
      onChange(resizeWidget(widgets, id, { w: widget.layout.w + delta.w, h: widget.layout.h + delta.h }, columns));
    },
  });
  return { resize, handlers, cancel: () => setResize(null) };
}
