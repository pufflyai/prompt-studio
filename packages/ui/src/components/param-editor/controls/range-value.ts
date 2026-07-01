import type { RangeValue } from "../param-editor.types";
import { clampToRange, snapToStep } from "./numeric-value";

/** Order both handles and clamp (and optionally snap) them into `[min, max]`. */
export const normalizeRange = (value: RangeValue, min: number, max: number, step?: number): RangeValue => {
  const first = clampToRange(value[0], min, max);
  const second = clampToRange(value[1], min, max);
  let start = Math.min(first, second);
  let end = Math.max(first, second);
  if (step && step > 0) {
    start = clampToRange(snapToStep(start, step, min), min, max);
    end = clampToRange(snapToStep(end, step, min), min, max);
  }
  return [start, end];
};

/** Replace a single handle, keeping the pair ordered. */
export const updateRangeHandle = (
  value: RangeValue,
  index: 0 | 1,
  next: number,
  min: number,
  max: number,
  step?: number,
): RangeValue => {
  const draft: RangeValue = index === 0 ? [next, value[1]] : [value[0], next];
  return normalizeRange(draft, min, max, step);
};
