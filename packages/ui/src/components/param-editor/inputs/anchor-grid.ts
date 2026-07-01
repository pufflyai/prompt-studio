import type { AnchorGridValue } from "../param-editor.types";

/** The nine anchors in row-major order (top-left → bottom-right). */
export const ANCHOR_GRID_VALUES: AnchorGridValue[] = [
  "top-left",
  "top",
  "top-right",
  "left",
  "center",
  "right",
  "bottom-left",
  "bottom",
  "bottom-right",
];

export const isAnchorGridValue = (value: unknown): value is AnchorGridValue =>
  typeof value === "string" && (ANCHOR_GRID_VALUES as string[]).includes(value);
