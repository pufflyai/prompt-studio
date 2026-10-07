import { type DragEvent, useEffect, useRef } from "react";

export const useBoardDragScroll = () => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const cleanup = useRef<(() => void) | null>(null);

  useEffect(() => () => cleanup.current?.(), []);

  const startDrag = (event: DragEvent<HTMLDivElement>) => {
    cleanup.current?.();
    const viewport = viewportRef.current;
    if (!viewport || viewport.scrollWidth <= viewport.clientWidth) return;

    const document = viewport.ownerDocument;
    const window = document.defaultView!;
    let pointer: { x: number; y: number } | null = { x: event.clientX, y: event.clientY };
    let previousTime = window.performance.now();
    let frame = 0;

    const trackPointer = (event: globalThis.DragEvent) => {
      pointer = { x: event.clientX, y: event.clientY };
    };
    const leaveDocument = (event: globalThis.DragEvent) => {
      // Leaving the document has no next dragover to update the pointer position.
      if (!event.relatedTarget) pointer = null;
    };
    const stop = () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("dragover", trackPointer, true);
      document.removeEventListener("dragleave", leaveDocument, true);
      document.removeEventListener("drop", stop, true);
      document.removeEventListener("dragend", stop, true);
      window.removeEventListener("blur", stop);
      cleanup.current = null;
    };
    const scroll = (time: number) => {
      const bounds = viewport.getBoundingClientRect();
      const edgeWidth = Math.min(96, bounds.width / 2);
      let speed = 0;
      if (
        pointer &&
        pointer.x >= bounds.left &&
        pointer.x <= bounds.right &&
        pointer.y >= bounds.top &&
        pointer.y <= bounds.bottom
      ) {
        const leftDistance = pointer.x - bounds.left;
        const rightDistance = bounds.right - pointer.x;
        if (leftDistance < edgeWidth) speed = -960 * (1 - leftDistance / edgeWidth);
        else if (rightDistance < edgeWidth) speed = 960 * (1 - rightDistance / edgeWidth);
      }
      viewport.scrollLeft += (speed * (time - previousTime)) / 1000;
      previousTime = time;
      frame = window.requestAnimationFrame(scroll);
    };

    // Native dragover events are sparse. Keep scrolling while a card is held near an edge.
    document.addEventListener("dragover", trackPointer, true);
    document.addEventListener("dragleave", leaveDocument, true);
    document.addEventListener("drop", stop, true);
    document.addEventListener("dragend", stop, true);
    window.addEventListener("blur", stop);
    cleanup.current = stop;
    frame = window.requestAnimationFrame(scroll);
  };

  return { viewportRef, startDrag };
};
