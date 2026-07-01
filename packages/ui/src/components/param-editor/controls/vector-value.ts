import type { VectorValue } from "../param-editor.types";
import { clampToRange } from "./numeric-value";

export interface VectorBounds {
  min?: number;
  max?: number;
}

const clampAxis = (value: number, bounds: VectorBounds) => {
  if (bounds.min === undefined && bounds.max === undefined) return value;
  const min = bounds.min ?? Number.NEGATIVE_INFINITY;
  const max = bounds.max ?? Number.POSITIVE_INFINITY;
  return clampToRange(value, min, max);
};

/** Update a single axis without dropping the other, clamping into optional bounds. */
export const updateVectorAxis = (
  value: VectorValue,
  axis: "x" | "y",
  next: number,
  bounds: VectorBounds = {},
): VectorValue => {
  const clamped = clampAxis(next, bounds);
  return axis === "x" ? { x: clamped, y: value.y } : { x: value.x, y: clamped };
};
