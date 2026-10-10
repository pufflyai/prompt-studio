// Keep zoom local to the open canvas and apply its anchored pan offset after the scaled layout updates.
import { type RefObject, useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from "react";
import { clampZoom, maximumZoom, minimumZoom, wheelZoom, zoomOffset } from "./canvas-zoom";

export function useCanvasZoom(ref: RefObject<HTMLDivElement | null>) {
  const [zoom, setZoom] = useState(1);
  const pending = useRef<Omit<Parameters<typeof zoomOffset>[0], "to"> | undefined>(undefined);
  const change = (value: number, anchor?: { x: number; y: number }) => {
    const next = clampZoom(value);
    if (next === zoom) {
      return;
    }

    const viewport = ref.current;
    if (viewport) {
      pending.current = {
        left: viewport.scrollLeft,
        top: viewport.scrollTop,
        width: viewport.clientWidth,
        height: viewport.clientHeight,
        from: zoom,
        anchor,
      };
    }

    setZoom(next);
  };

  const changeFromWheel = useEffectEvent(change);
  useEffect(() => {
    const viewport = ref.current;
    if (!viewport) {
      return;
    }

    // Accumulate small trackpad deltas until they change the rounded zoom level.
    let delta = 0;
    const wheel = (event: WheelEvent) => {
      if (event.deltaY === 0) {
        return;
      }

      event.preventDefault();
      delta += event.deltaY * ([1, 16, viewport.clientHeight][event.deltaMode] ?? 1);
      const bounds = viewport.getBoundingClientRect();
      changeFromWheel(wheelZoom(zoom, { y: delta, mode: 0, pageHeight: viewport.clientHeight }), {
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      });
      if ((zoom === maximumZoom && delta < 0) || (zoom === minimumZoom && delta > 0)) {
        delta = 0;
      }
    };
    // React wheel listeners are passive; the native listener prevents the host page from scrolling.
    viewport.addEventListener("wheel", wheel, { passive: false });
    return () => viewport.removeEventListener("wheel", wheel);
  }, [ref, zoom]);

  useLayoutEffect(() => {
    if (pending.current) {
      ref.current?.scrollTo(zoomOffset({ ...pending.current, to: zoom }));
      pending.current = undefined;
    }
  }, [zoom, ref]);

  return { zoom, change };
}
