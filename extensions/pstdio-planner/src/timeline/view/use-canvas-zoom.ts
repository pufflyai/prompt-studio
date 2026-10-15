// Keep zoom local to the open canvas and apply its anchored pan offset after the scaled layout updates.
import { type RefObject, useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from "react";
import { clampZoom, wheelZoom, type ZoomOrigin, zoomOffset } from "./canvas-zoom";

export function useCanvasZoom(ref: RefObject<HTMLDivElement | null>) {
  // Anchored gestures still move the viewport when a batched pinch returns to its original scale.
  const [{ zoom }, setZoom] = useState({ zoom: 1 });
  const current = useRef(1);
  const pending = useRef<Parameters<typeof zoomOffset>[0] | undefined>(undefined);
  const change = (value: number, anchor?: { x: number; y: number }, origin?: ZoomOrigin) => {
    const next = clampZoom(value);
    if (next === current.current && !origin) {
      return;
    }

    const viewport = ref.current;
    if (viewport) {
      const offset = pending.current
        ? zoomOffset(pending.current)
        : { left: viewport.scrollLeft, top: viewport.scrollTop };
      const position = {
        left: origin?.left ?? offset.left,
        top: origin?.top ?? offset.top,
        width: viewport.clientWidth,
        height: viewport.clientHeight,
        from: origin?.zoom ?? current.current,
        to: next,
        anchor: origin?.anchor ?? anchor,
        targetAnchor: anchor,
      };
      if (next === current.current && !pending.current) {
        viewport.scrollTo(zoomOffset(position));
      } else {
        pending.current = position;
      }
    }

    current.current = next;
    setZoom({ zoom: next });
  };

  const wheel = useEffectEvent((event: WheelEvent) => {
    const viewport = ref.current;
    if (!viewport) return;
    event.preventDefault();
    if (!event.ctrlKey) {
      const unit = [1, 16, viewport.clientHeight][event.deltaMode] ?? 1;
      viewport.scrollBy({ left: event.deltaX * unit, top: event.deltaY * unit });
      return;
    }
    const bounds = viewport.getBoundingClientRect();
    change(wheelZoom(current.current, { y: event.deltaY, mode: event.deltaMode, pageHeight: viewport.clientHeight }), {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    });
  });
  useEffect(() => {
    const viewport = ref.current;
    if (!viewport) {
      return;
    }

    // React wheel listeners are passive; the native listener prevents the host page from scrolling.
    viewport.addEventListener("wheel", wheel, { passive: false });
    return () => viewport.removeEventListener("wheel", wheel);
  }, [ref]);

  useLayoutEffect(() => {
    if (pending.current) {
      ref.current?.scrollTo(zoomOffset(pending.current));
      pending.current = undefined;
    }
  });

  return { zoom, change };
}
