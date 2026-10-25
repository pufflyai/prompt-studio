import type { CanvasCamera, CanvasZoomChange, CanvasZoomLimits } from "./canvas.types";

export const defaultCanvasZoomLimits = { minZoom: 0.25, maxZoom: 1 };

export const clampCanvasZoom = (zoom: number, limits: CanvasZoomLimits) =>
  Math.min(limits.maxZoom, Math.max(limits.minZoom, zoom));

export const constrainCanvasZoom = (zoom: number, change: CanvasZoomChange, limits: CanvasZoomLimits) => {
  if (!Number.isFinite(zoom) || zoom <= 0) return;
  if (!Number.isFinite(change.factor) || change.factor <= 0) return;
  const next = clampCanvasZoom(zoom * change.factor, limits);
  return { zoom: next, change: { ...change, factor: next / zoom } };
};

export const zoomCanvas = (
  camera: CanvasCamera,
  change: CanvasZoomChange,
  limits: CanvasZoomLimits = defaultCanvasZoomLimits,
) => {
  const next = constrainCanvasZoom(camera.zoom, change, limits);
  if (!next) return camera;
  const { zoom } = next;
  const ratio = next.change.factor;
  const target = change.targetAnchor ?? change.anchor;
  return {
    x: target.x - (change.anchor.x - camera.x) * ratio,
    y: target.y - (change.anchor.y - camera.y) * ratio,
    zoom,
  };
};
