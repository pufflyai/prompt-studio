import type { CanvasCamera, CanvasZoomChange, CanvasZoomLimits } from "./canvas.types";

export const zoomCanvas = (
  camera: CanvasCamera,
  change: CanvasZoomChange,
  limits: CanvasZoomLimits = { minZoom: 0.25, maxZoom: 1 },
) => {
  if (!Number.isFinite(change.factor) || change.factor <= 0) return camera;
  const zoom = Math.min(limits.maxZoom, Math.max(limits.minZoom, camera.zoom * change.factor));
  const ratio = zoom / camera.zoom;
  const target = change.targetAnchor ?? change.anchor;
  return {
    x: target.x - (change.anchor.x - camera.x) * ratio,
    y: target.y - (change.anchor.y - camera.y) * ratio,
    zoom,
  };
};
