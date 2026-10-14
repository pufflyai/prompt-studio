import { type DragEvent, useEffect, useRef } from "react";

const edgeSpeed = (coordinate: number, start: number, size: number) => {
  if (coordinate < start || coordinate > start + size) return 0;
  const edge = Math.min(96, size / 2);
  const near = coordinate - start;
  const far = start + size - coordinate;
  if (near < edge) return -960 * (1 - near / edge);
  if (far < edge) return 960 * (1 - far / edge);
  return 0;
};

export const useBoardDragScroll = () => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const cleanup = useRef<(() => void) | null>(null);

  useEffect(() => () => cleanup.current?.(), []);

  const startDrag = (event: DragEvent<HTMLDivElement>) => {
    cleanup.current?.();
    const viewport = viewportRef.current;
    if (!viewport) return;

    const document = viewport.ownerDocument;
    const window = document.defaultView!;
    let columnViewport: HTMLElement | null = null;
    let pointer: { x: number; y: number } | null = { x: event.clientX, y: event.clientY };
    let previousTime = window.performance.now();
    let frame = 0;

    const trackPointer = (event: globalThis.DragEvent) => {
      pointer = { x: event.clientX, y: event.clientY };
      columnViewport =
        event.target instanceof Element ? event.target.closest<HTMLElement>("[data-board-column-viewport]") : null;
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
      const elapsed = (time - previousTime) / 1000;
      if (pointer && pointer.y >= bounds.top && pointer.y <= bounds.bottom) {
        viewport.scrollLeft += edgeSpeed(pointer.x, bounds.left, bounds.width) * elapsed;
      }
      if (columnViewport && pointer) {
        const column = columnViewport.getBoundingClientRect();
        columnViewport.scrollTop += edgeSpeed(pointer.y, column.top, column.height) * elapsed;
      }
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
