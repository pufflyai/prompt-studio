import { card, grid, ISO_ACCENT, ISO_SURFACE, ISO_TINT, kindColor, kpi, wave, wire } from "../greek";
import type { BoxSpec } from "../scene";

export type Shape = "board" | "layers" | "viewer" | "dashboard";
export type ShapePart = BoxSpec & { card?: boolean; column?: number; layer?: boolean; cube?: boolean; bar?: boolean };

export interface Area {
  x: number;
  y: number;
  w: number;
  d: number;
}

export const LAYER_COLORS = [kindColor("skill"), kindColor("page"), kindColor("command"), kindColor("automation")].map(
  (color) => `color-mix(in oklab, ${color} 75%, ${ISO_SURFACE})`,
);

export const columnWidth = (area: Area) => (area.w - 4 * 5) / 3;
export const columnX = (area: Area, column: number) => area.x + 5 + column * (columnWidth(area) + 5);
export const cardY = (area: Area, row: number) => area.y + 10 + row * 34;

/** The pieces each shape builds on the workbench's main area. */
export const SHAPE_LAYOUTS: Record<Shape, (area: Area) => ShapePart[]> = {
  board: (area) =>
    [3, 2, 1].flatMap((count, column) => [
      { x: columnX(area, column), y: area.y + 4, w: columnWidth(area), d: area.d - 8, h: 2, z: 10, color: ISO_TINT },
      ...Array.from({ length: count }, (_, row) => ({
        x: columnX(area, column) + 4,
        y: cardY(area, row),
        w: columnWidth(area) - 8,
        d: 28,
        h: 5,
        z: 12,
        html: card(),
        drag: true,
        card: true,
        column,
      })),
    ]),
  layers: (area) => [
    { x: area.x + 4, y: area.y + 4, w: 96, d: area.d - 8, h: 2, z: 10, html: wave() },
    ...LAYER_COLORS.map((color, i) => ({
      x: area.x + 110,
      y: area.y + 40,
      w: 48,
      d: 64,
      h: 3,
      z: 16 + i * 18,
      color,
      drag: true,
      float: true,
      layer: true,
    })),
  ],
  viewer: (area) => [
    { x: area.x + 4, y: area.y + 4, w: area.w - 8, d: area.d - 8, h: 2, z: 10, html: grid() },
    {
      x: area.x + area.w / 2 - 30,
      y: area.y + area.d / 2 - 30,
      w: 60,
      d: 60,
      h: 60,
      z: 12,
      color: kindColor("editor"),
      html: wire(),
      sideHtml: wire(),
      drag: true,
      cube: true,
    },
    {
      x: area.x + 14,
      y: area.y + area.d - 40,
      w: 22,
      d: 22,
      h: 22,
      z: 12,
      color: kindColor("command"),
      drag: true,
      cube: true,
    },
  ],
  dashboard: (area) => [
    ...[0, 1, 2].map((i) => ({ x: area.x + 4 + i * 52, y: area.y + 4, w: 48, d: 30, h: 4, z: 10, html: kpi() })),
    { x: area.x + 4, y: area.y + 42, w: area.w - 8, d: area.d - 46, h: 2, z: 10, color: ISO_TINT },
    ...[30, 48, 22, 60, 40, 72].map((h, i) => ({
      x: area.x + 14 + i * 24,
      y: area.y + 74,
      w: 14,
      d: 14,
      h,
      z: 12,
      color: ISO_ACCENT,
      bar: true,
    })),
  ],
};
