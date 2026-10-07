import { type PointerEvent, useRef, useState } from "react";

interface BoardPan {
  pointerId: number;
  startX: number;
  scrollLeft: number;
}

const interactiveTarget =
  'button, a, input, textarea, select, [role="button"], [contenteditable]:not([contenteditable="false"]), [data-board-pan-ignore], [data-scope="scroll-area"][data-part="scrollbar"]';

export const useBoardPan = () => {
  const pan = useRef<BoardPan | null>(null);
  const [isPanning, setIsPanning] = useState(false);

  const finishPan = (event: PointerEvent<HTMLDivElement>) => {
    if (pan.current?.pointerId !== event.pointerId) return;
    pan.current = null;
    setIsPanning(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return {
    cursor: isPanning ? "grabbing" : "grab",
    userSelect: isPanning ? "none" : undefined,
    onPointerDownCapture: (event: PointerEvent<HTMLDivElement>) => {
      // Leave touch scrolling and card/control gestures with their existing owners.
      if (event.pointerType !== "mouse" || event.button !== 0 || !event.isPrimary) return;
      if (!(event.target instanceof Element) || event.target.closest(interactiveTarget)) return;
      const viewport = event.currentTarget;
      if (viewport.scrollWidth <= viewport.clientWidth) return;

      event.preventDefault();
      viewport.setPointerCapture(event.pointerId);
      pan.current = { pointerId: event.pointerId, startX: event.clientX, scrollLeft: viewport.scrollLeft };
      setIsPanning(true);
    },
    onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
      const gesture = pan.current;
      if (!gesture || gesture.pointerId !== event.pointerId) return;
      if ((event.buttons & 1) === 0) {
        finishPan(event);
        return;
      }
      event.currentTarget.scrollLeft = gesture.scrollLeft + gesture.startX - event.clientX;
    },
    onPointerUp: finishPan,
    onPointerCancel: finishPan,
    onLostPointerCapture: finishPan,
  };
};
