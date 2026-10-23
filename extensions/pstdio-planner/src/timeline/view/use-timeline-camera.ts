import { type CanvasCamera, type CanvasPoint, type CanvasZoomChange, zoomCanvas } from "@pstdio/ui";
import { type RefObject, useLayoutEffect, useRef, useState } from "react";

// Planner keeps native scrolling for sticky headers and the card window. Canvas owns the input gestures.
export function useTimelineCamera(ref: RefObject<HTMLDivElement | null>) {
  const [{ zoom }, setZoom] = useState({ zoom: 1 });
  const currentZoom = useRef(1);
  const pending = useRef<CanvasCamera | undefined>(undefined);
  const changeZoom = (change: CanvasZoomChange) => {
    const viewport = ref.current!;
    const current = pending.current ?? {
      x: -viewport.scrollLeft,
      y: -viewport.scrollTop,
      zoom: currentZoom.current,
    };
    const next = zoomCanvas(current, change);
    // Native scrolling stops at the origin, including between batched zoom requests.
    next.x = Math.min(0, next.x);
    next.y = Math.min(0, next.y);
    pending.current = next;
    currentZoom.current = next.zoom;
    setZoom({ zoom: next.zoom });
  };
  const pan = (delta: CanvasPoint) => {
    if (pending.current) {
      pending.current.x = Math.min(0, pending.current.x + delta.x);
      pending.current.y = Math.min(0, pending.current.y + delta.y);
    } else {
      ref.current?.scrollBy({ left: -delta.x, top: -delta.y });
    }
  };
  useLayoutEffect(() => {
    const next = pending.current;
    if (next) ref.current?.scrollTo({ left: -next.x, top: -next.y });
    pending.current = undefined;
  });
  return { zoom, pan, changeZoom };
}
