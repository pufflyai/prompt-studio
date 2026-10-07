// Pan the bounded graph viewport with a pointer while leaving ticket dragging and controls interactive.
import { type KeyboardEvent, type PointerEvent, type RefObject, useRef, useState } from "react";

const controls =
  "[data-ticket], [data-canvas-control], button, input, a, [role=button], [role=menuitem], [data-part=preview]";

export function useCanvasPan(ref: RefObject<HTMLDivElement | null>) {
  const drag = useRef<{ pointerId: number; x: number; y: number; left: number; top: number } | undefined>(undefined);
  const moved = useRef(false);
  const [panning, setPanning] = useState(false);
  const finish = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId !== event.pointerId) {
      return;
    }

    drag.current = undefined;
    setPanning(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return {
    panning,
    handlers: {
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

      onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
        if (event.button !== 0 || (event.target as Element).closest(controls)) {
          return;
        }

        moved.current = false;
        drag.current = {
          pointerId: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          left: event.currentTarget.scrollLeft,
          top: event.currentTarget.scrollTop,
        };
        event.currentTarget.focus({ preventScroll: true });
        event.currentTarget.setPointerCapture(event.pointerId);
        event.preventDefault();
      },
      onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
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
      onPointerUp: finish,
      onPointerCancel: finish,
      onLostPointerCapture: finish,
    },
  };
}
