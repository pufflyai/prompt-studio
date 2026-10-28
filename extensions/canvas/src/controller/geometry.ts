export interface Point {
  x: number;
  y: number;
}
export interface Camera extends Point {
  zoom: number;
}
export interface Bounds extends Point {
  width: number;
  height: number;
}
export const limit = 100_000;
const cameraLimit = 1_000_000;
const minimumZoom = 0.000001;
export const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
export const boundedPoint = (point: Point) => ({
  x: finite(point.x) ? clamp(point.x, -limit, limit) : 0,
  y: finite(point.y) ? clamp(point.y, -limit, limit) : 0,
});
export const boundedCamera = (camera: Camera) => ({
  // Scaled positions need a wider translation range than the item coordinates.
  x: finite(camera.x) ? clamp(camera.x, -cameraLimit, cameraLimit) : 0,
  y: finite(camera.y) ? clamp(camera.y, -cameraLimit, cameraLimit) : 0,
  zoom: finite(camera.zoom) ? clamp(camera.zoom, minimumZoom, 4) : 1,
});
export const screenToCanvas = (camera: Camera, point: Point) => ({
  x: (point.x - camera.x) / camera.zoom,
  y: (point.y - camera.y) / camera.zoom,
});
export const zoomAt = (camera: Camera, point: Point, zoom: number) => {
  const bounded = boundedCamera({ ...camera, zoom });
  const anchor = screenToCanvas(camera, point);
  return boundedCamera({
    x: point.x - anchor.x * bounded.zoom,
    y: point.y - anchor.y * bounded.zoom,
    zoom: bounded.zoom,
  });
};
export const fitCamera = (bounds: Bounds, viewport: { width: number; height: number }) => {
  const zoom = clamp(
    Math.min(
      Math.max(1, viewport.width - 48) / Math.max(1, bounds.width),
      Math.max(1, viewport.height - 48) / Math.max(1, bounds.height),
    ),
    minimumZoom,
    1,
  );
  return boundedCamera({
    x: (viewport.width - bounds.width * zoom) / 2 - bounds.x * zoom,
    y: (viewport.height - bounds.height * zoom) / 2 - bounds.y * zoom,
    zoom,
  });
};

const revealAxis = (start: number, length: number, viewport: number) => {
  const margin = 16;
  if (length > viewport - margin * 2) return (viewport - length) / 2 - start;
  if (start < margin) return margin - start;
  if (start + length > viewport - margin) return viewport - margin - start - length;
  return 0;
};
export const revealCamera = (camera: Camera, bounds: Bounds, viewport: { width: number; height: number }) =>
  boundedCamera({
    ...camera,
    x: camera.x + revealAxis(bounds.x, bounds.width, viewport.width),
    y: camera.y + revealAxis(bounds.y, bounds.height, viewport.height),
  });
