// Limit canvas zoom and preserve the canvas point at the center or pointer when its scale changes.
export const minimumZoom = 0.25;
export const maximumZoom = 1;

export function clampZoom(value: number) {
  return Math.min(maximumZoom, Math.max(minimumZoom, Math.round(value * 100) / 100));
}

export function wheelZoom(zoom: number, delta: { y: number; mode: number; pageHeight: number }) {
  const units = [1, 16, delta.pageHeight];
  const pixels = delta.y * (units[delta.mode] ?? 1);
  return clampZoom(zoom * Math.exp(-pixels / 1000));
}

export function zoomOffset(viewport: {
  left: number;
  top: number;
  width: number;
  height: number;
  from: number;
  to: number;
  anchor?: { x: number; y: number };
}) {
  const ratio = viewport.to / viewport.from;
  const anchor = viewport.anchor ?? { x: viewport.width / 2, y: viewport.height / 2 };
  return {
    left: Math.max(0, (viewport.left + anchor.x) * ratio - anchor.x),
    top: Math.max(0, (viewport.top + anchor.y) * ratio - anchor.y),
  };
}
