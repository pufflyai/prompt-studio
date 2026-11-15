export const compareQueryStrings = (left: string, right: string) => {
  const a = Array.from(left, (character) => character.codePointAt(0)!);
  const b = Array.from(right, (character) => character.codePointAt(0)!);
  for (let position = 0; position < Math.min(a.length, b.length); position++)
    if (a[position] !== b[position]) return a[position] - b[position];
  return a.length - b.length;
};

/** PostgreSQL text cannot represent these code units. Preserve them with the binary query order. */
export const isLocaleQueryText = (value: string) => !/[\0\ud800-\udfff]/u.test(value);

export const compareLocaleQueryText = (left: string, right: string, locale?: string, natural = true) => {
  const safeLeft = isLocaleQueryText(left),
    safeRight = isLocaleQueryText(right);
  if (safeLeft !== safeRight) return Number(safeRight) - Number(safeLeft);
  if (!safeLeft) return compareQueryStrings(left, right);
  return left.localeCompare(right, locale, { numeric: natural, sensitivity: natural ? "base" : "variant" });
};
