import { boundedCamera, boundedPoint, type Camera, finite, type Point } from "./controller/geometry";
// A frame theme is an id: a built-in theme, "app", or a theme only the project knows.
export type FrameTheme = string;
export const isFrameTheme = (value: unknown): value is FrameTheme =>
  typeof value === "string" && value.length > 0 && value.length <= 200;
export interface Layout {
  version: 1;
  camera: Camera;
  positions: Record<string, Point>;
  themes: Record<string, FrameTheme>;
}
export interface LayoutChange {
  camera?: Camera;
  positions?: Record<string, Point>;
  themes?: Record<string, FrameTheme>;
}
export interface PlacedItem {
  id: string;
  position: Point;
}
export const object = (value: unknown) =>
  (value && typeof value === "object" && !Array.isArray(value) ? value : {}) as Record<string, unknown>;
const point = (value: unknown) => {
  const record = object(value);
  return finite(record.x) && finite(record.y) ? boundedPoint({ x: record.x, y: record.y }) : undefined;
};
export const readLayout = (input: unknown, items: readonly PlacedItem[]) => {
  const document = object(input);
  const saved = document.version === 1 ? document : {};
  const camera = object(saved.camera);
  const positions = object(saved.positions);
  const themes = object(saved.themes);
  return {
    version: 1 as const,
    camera: boundedCamera({
      x: finite(camera.x) ? camera.x : 24,
      y: finite(camera.y) ? camera.y : 24,
      zoom: finite(camera.zoom) ? camera.zoom : 1,
    }),
    positions: Object.fromEntries(
      items.map((item) => [item.id, point(positions[item.id]) ?? boundedPoint(item.position)]),
    ),
    themes: Object.fromEntries(
      items.flatMap((item) => (isFrameTheme(themes[item.id]) ? [[item.id, themes[item.id]]] : [])),
    ) as Record<string, FrameTheme>,
  };
};
export const updateLayout = (current: Layout, change: unknown, items: readonly PlacedItem[]) => {
  if (JSON.stringify(change).length > 64_000) throw new Error("Layout changes must be smaller than 64 KB");
  const patch = object(change);
  return readLayout(
    {
      version: 1,
      camera: patch.camera ?? current.camera,
      positions: { ...current.positions, ...object(patch.positions) },
      themes: { ...current.themes, ...object(patch.themes) },
    },
    items,
  );
};
