/** Clamp `value` into the inclusive range, tolerating an inverted min/max. */
export const clampToRange = (value: number, min: number, max: number) => {
  const lower = Math.min(min, max);
  const upper = Math.max(min, max);
  if (value < lower) return lower;
  if (value > upper) return upper;
  return value;
};

/** Snap `value` to the nearest multiple of `step` measured from `origin`. */
export const snapToStep = (value: number, step: number, origin = 0) => {
  if (!(step > 0)) return value;
  const steps = Math.round((value - origin) / step);
  return origin + steps * step;
};

interface ResolveNumericValueInput {
  value: number;
  min: number;
  max: number;
  step?: number;
  discrete?: boolean;
}

/** Clamp, then snap discrete values to the step grid anchored at `min`. */
export const resolveNumericValue = (input: ResolveNumericValueInput) => {
  const { value, min, max, step, discrete } = input;
  const clamped = clampToRange(value, min, max);
  if (!discrete || !step) return clamped;
  return clampToRange(snapToStep(clamped, step, min), min, max);
};

/** Format a number with an optional unit suffix, trimming float noise. */
export const formatUnitValue = (value: number, unit?: string) => {
  const rounded = Number.isInteger(value) ? `${value}` : `${Number(value.toFixed(3))}`;
  return unit ? `${rounded}${unit}` : rounded;
};

/** Parse an editable value label back into a number, tolerating the unit suffix. */
export const parseUnitValue = (input: string, unit?: string) => {
  let text = input.trim();
  if (unit && text.toLowerCase().endsWith(unit.toLowerCase())) {
    text = text.slice(0, text.length - unit.length).trim();
  }
  const parsed = Number.parseFloat(text);
  return Number.isNaN(parsed) ? null : parsed;
};
