const isPlainData = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

/**
 * Returns `next`, reusing every part that equals the same part of `previous`. A reload that returns
 * equal data gives back `previous` itself, so views showing it do not render again; when one row
 * changes, the other rows keep their objects. Only arrays and plain objects are compared.
 */
export const shareEqualValue = <T>(previous: unknown, next: T): T => {
  if (Object.is(previous, next)) return next;
  if (Array.isArray(previous) && Array.isArray(next)) {
    const shared = next.map((item, index) => shareEqualValue(previous[index], item));
    const same = shared.length === previous.length && shared.every((item, index) => item === previous[index]);
    return (same ? previous : shared) as T;
  }
  if (isPlainData(previous) && isPlainData(next)) {
    const keys = Object.keys(next);
    const shared = Object.fromEntries(keys.map((key) => [key, shareEqualValue(previous[key], next[key])]));
    const same =
      keys.length === Object.keys(previous).length &&
      keys.every((key) => Object.hasOwn(previous, key) && shared[key] === previous[key]);
    return (same ? previous : shared) as T;
  }
  return next;
};
