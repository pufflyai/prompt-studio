import { type RefObject, useLayoutEffect, useRef, useState } from "react";
import { type CanvasCamera, type CanvasPoint, type CanvasZoomChange, zoomCanvas } from "../canvas";

export const useTimelineCamera = (viewport: RefObject<HTMLDivElement | null>) => {
  const [{ zoom }, setZoom] = useState({ zoom: 1 });
  const current = useRef(1);
  const pending = useRef<CanvasCamera | undefined>(undefined);
  const onZoom = (change: CanvasZoomChange) => {
    const camera = pending.current ?? {
      x: -viewport.current!.scrollLeft,
      y: -viewport.current!.scrollTop,
      zoom: current.current,
    };
    const next = zoomCanvas(camera, change);
    // Native scrolling cannot pan before the beginning of the content.
    pending.current = { ...next, x: Math.min(0, next.x), y: Math.min(0, next.y) };
    current.current = next.zoom;
    setZoom({ zoom: next.zoom });
  };
  const onPan = (delta: CanvasPoint) => {
    if (pending.current) {
      pending.current = {
        ...pending.current,
        x: Math.min(0, pending.current.x + delta.x),
        y: Math.min(0, pending.current.y + delta.y),
      };
    } else viewport.current?.scrollBy({ left: -delta.x, top: -delta.y });
  };
  const onReset = () => {
    pending.current = { x: 0, y: 0, zoom: 1 };
    current.current = 1;
    setZoom({ zoom: 1 });
  };
  useLayoutEffect(() => {
    const next = pending.current;
    if (next) viewport.current?.scrollTo({ left: -next.x, top: -next.y });
    pending.current = undefined;
  });
  return { zoom, onPan, onZoom, onReset };
};
