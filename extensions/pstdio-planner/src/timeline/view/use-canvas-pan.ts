// Pan the bounded graph viewport with a pointer while leaving ticket dragging and controls interactive.
import { type KeyboardEvent, type MouseEvent, type PointerEvent, type RefObject, useRef, useState } from "react";
import type { ZoomOrigin } from "./canvas-zoom";
import type { useCanvasZoom } from "./use-canvas-zoom";

const controls =
  "[data-ticket], [data-canvas-control], button, input, textarea, a, [role=button], [role=menuitem], [data-part=preview]";

interface Point {
  x: number;
  y: number;
}

function pinchPosition(points: Map<number, Point>, viewport: HTMLDivElement) {
  const [first, second] = [...points.values()];
  const bounds = viewport.getBoundingClientRect();
  return {
    distance: Math.hypot(second.x - first.x, second.y - first.y),
    anchor: { x: (first.x + second.x) / 2 - bounds.left, y: (first.y + second.y) / 2 - bounds.top },
  };
}

export function useCanvasPan(
  ref: RefObject<HTMLDivElement | null>,
  zoom: number,
  changeZoom: ReturnType<typeof useCanvasZoom>["change"],
) {
  const drag = useRef<{ pointerId: number; x: number; y: number; left: number; top: number } | undefined>(undefined);
  const touches = useRef(new Map<number, Point>());
  const pinch = useRef<(ZoomOrigin & { distance: number }) | undefined>(undefined);
  const moved = useRef(false);
  const [panning, setPanning] = useState(false);
  const startPinch = (viewport: HTMLDivElement) => {
    pinch.current = {
      ...pinchPosition(touches.current, viewport),
      zoom,
      left: viewport.scrollLeft,
      top: viewport.scrollTop,
    };
    drag.current = undefined;
    for (const pointerId of touches.current.keys()) viewport.setPointerCapture(pointerId);
  };
  const finish = (event: PointerEvent<HTMLDivElement>) => {
    if (!touches.current.delete(event.pointerId) && drag.current?.pointerId !== event.pointerId) {
      return;
    }

    drag.current = undefined;
    pinch.current = undefined;
    setPanning(false);
    const [remaining] = touches.current;
    if (remaining) {
      const [pointerId, point] = remaining;
      drag.current = { pointerId, ...point, left: event.currentTarget.scrollLeft, top: event.currentTarget.scrollTop };
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return {
    panning,
    handlers: {
      onClickCapture: (event: MouseEvent<HTMLDivElement>) => {
        if (event.currentTarget.contains(event.target as Node) && moved.current && event.detail > 0) {
          event.preventDefault();
          event.stopPropagation();
        }
      },
      onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.target !== event.currentTarget) {
          return;
        }

        const steps: Record<string, [number, number]> = {
          ArrowLeft: [-80, 0],
          ArrowRight: [80, 0],
          ArrowUp: [0, -80],
          ArrowDown: [0, 80],
        };
        const step = steps[event.key];
        if (step) {
          event.preventDefault();
          event.currentTarget.scrollBy({ left: step[0], top: step[1] });
        }
      },

      onPointerDownCapture: (event: PointerEvent<HTMLDivElement>) => {
        // Portalled menus bubble through React, but their pointers belong to the menu, not the canvas.
        if (event.button !== 0 || !event.currentTarget.contains(event.target as Node)) {
          return;
        }

        if (touches.current.size === 0) moved.current = false;
        if (event.pointerType === "touch") {
          if (touches.current.size === 2) {
            event.preventDefault();
            return;
          }
          touches.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
          if (touches.current.size === 2) {
            startPinch(event.currentTarget);
            event.preventDefault();
            return;
          }
        }
        if ((event.target as Element).closest(controls)) return;
        drag.current = {
          pointerId: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          left: event.currentTarget.scrollLeft,
          top: event.currentTarget.scrollTop,
        };
        // Focus keeps arrow-key panning. It comes from the pointer, so it must not draw a keyboard focus ring.
        event.currentTarget.focus({ preventScroll: true, focusVisible: false });
        event.currentTarget.setPointerCapture(event.pointerId);
        event.preventDefault();
      },
      onPointerMoveCapture: (event: PointerEvent<HTMLDivElement>) => {
        if (touches.current.has(event.pointerId)) {
          touches.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        }
        if (pinch.current && ref.current) {
          const position = pinchPosition(touches.current, ref.current);
          moved.current = true;
          setPanning(true);
          changeZoom((pinch.current.zoom * position.distance) / pinch.current.distance, position.anchor, pinch.current);
          event.preventDefault();
          return;
        }
        const start = drag.current;
        if (!start || start.pointerId !== event.pointerId || !ref.current) {
          return;
        }

        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        if (!moved.current && Math.hypot(dx, dy) < 4) {
          return;
        }

        moved.current = true;
        setPanning(true);
        ref.current.scrollLeft = start.left - dx;
        ref.current.scrollTop = start.top - dy;
      },
      onPointerUpCapture: finish,
      onPointerCancelCapture: finish,
      onLostPointerCapture: (event: PointerEvent<HTMLDivElement>) => {
        // A touch on a card first has implicit capture there. Transferring it to the canvas is not a gesture end.
        if (event.target === event.currentTarget) finish(event);
      },
    },
  };
}
