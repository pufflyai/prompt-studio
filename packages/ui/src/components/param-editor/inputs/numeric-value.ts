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

/** Format a number with an optional unit suffix, trimming float noise. */
export const formatUnitValue = (value: number, unit?: string) => {
  const rounded = Number.isInteger(value) ? `${value}` : `${Number(value.toFixed(3))}`;
  return unit ? `${rounded}${unit}` : rounded;
};
