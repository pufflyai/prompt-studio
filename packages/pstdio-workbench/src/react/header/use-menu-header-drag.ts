import type { PointerEvent, RefObject } from "react";
import { useRef, useState } from "react";
import { type MenuHeaderPosition, menuHeaderPositions } from "../../core/controllers/panel-menus/menu-header-settings";

/** Empty header space docks the header; its controls keep their own pointer gestures. */
export const useMenuHeaderDrag = (
  root: RefObject<HTMLDivElement | null>,
  dock: (position: MenuHeaderPosition) => void,
) => {
  const start = useRef<{ id: number; x: number; y: number; active: boolean; dock: typeof dock } | null>(null);
  const [dragging, setDragging] = useState(false);
  const reset = () => {
    start.current = null;
    setDragging(false);
  };
  return {
    dragging,
    handlers: {
      onPointerDownCapture: (event: PointerEvent<HTMLDivElement>) => {
        if (
          start.current ||
          !event.currentTarget.contains(event.target as Node) ||
          event.button !== 0 ||
          (event.target as Element).closest(
            "[data-action-bar-item], button, input, textarea, select, [contenteditable]:not([contenteditable=false])",
          )
        )
          return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        start.current = { id: event.pointerId, x: event.clientX, y: event.clientY, active: false, dock };
      },
      onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
        const gesture = start.current;
        if (!gesture || gesture.id !== event.pointerId) return;
        if (!gesture.active && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) >= 5) {
          gesture.active = true;
          setDragging(true);
        }
      },
      onPointerUp: (event: PointerEvent<HTMLDivElement>) => {
        const gesture = start.current;
        if (!gesture || gesture.id !== event.pointerId) return;
        reset();
        const bounds = root.current?.getBoundingClientRect();
        if (!gesture.active || !bounds) return;
        const { clientX: x, clientY: y } = event;
        if (x < bounds.left || x > bounds.right || y < bounds.top || y > bounds.bottom) return;
        const distance = {
          top: y - bounds.top,
          right: bounds.right - x,
          bottom: bounds.bottom - y,
          left: x - bounds.left,
        };
        const edge = menuHeaderPositions.reduce((a, b) => (distance[a] < distance[b] ? a : b));
        if (distance[edge] <= 32) gesture.dock(edge);
      },
      onPointerCancel: reset,
      onLostPointerCapture: reset,
    },
  };
};
