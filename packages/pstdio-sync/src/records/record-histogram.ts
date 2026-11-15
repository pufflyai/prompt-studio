// JSON numbers have a finite decimal spelling. Integer arithmetic keeps bin boundaries
// identical to SQL NUMERIC, including subnormals and ranges wider than a JS number.
const decimal = (value: number) => {
  const [mantissa, power = "0"] = String(value).split("e");
  const fraction = mantissa.split(".")[1]?.length ?? 0;
  return { coefficient: BigInt(mantissa.replace(".", "")), exponent: Number(power) - fraction };
};
const align = (value: ReturnType<typeof decimal>, exponent: number) =>
  value.coefficient * 10n ** BigInt(value.exponent - exponent);

export const histogramBucket = (value: number, min: number, max: number, bins: number) => {
  if (value === max || min === max) return bins - 1;
  const low = decimal(min),
    high = decimal(max),
    item = decimal(value);
  const exponent = Math.min(low.exponent, high.exponent, item.exponent);
  const lower = align(low, exponent);
  return Number(((align(item, exponent) - lower) * BigInt(bins)) / (align(high, exponent) - lower));
};

export const histogramResult = (min: number, max: number, count: number, values: Map<number, number>) => {
  const low = decimal(min),
    high = decimal(max);
  const exponent = Math.min(low.exponent, high.exponent);
  const lower = align(low, exponent),
    upper = align(high, exponent);
  const boundary = (index: number) => {
    const numerator = lower * BigInt(count - index) + upper * BigInt(index);
    // Keep twenty extra decimal places before parsing the final IEEE-754 boundary.
    return Number(`${(numerator * 10n ** 20n) / BigInt(count)}e${exponent - 20}`);
  };
  return {
    min,
    max,
    bins: Array.from({ length: count }, (_, i) => ({
      start: boundary(i),
      end: boundary(i + 1),
      count: values.get(i) ?? 0,
    })),
  };
};
