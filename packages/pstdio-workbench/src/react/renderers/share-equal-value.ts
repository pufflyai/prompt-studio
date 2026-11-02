const isPlainData = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const hasId = (value: unknown): value is { id: string } => isPlainData(value) && typeof value.id === "string";

// Equal parts move into the loaded value in place: views, and lookups keyed by the loaded objects, keep finding
// each changed object as it was loaded. Frozen values and accessor properties stay as loaded.
const replaceInPlace = (target: object, key: string | number, value: unknown) => {
  if (Object.isFrozen(target)) return;
  if (Object.getOwnPropertyDescriptor(target, key)?.writable) (target as Record<string | number, unknown>)[key] = value;
};

/**
 * Returns `previous` when `next` equals it. Otherwise returns `next` itself, with every part that equals the
 * matching part of `previous` replaced, in place, by that part. A reload that changed nothing gives back the value
 * on screen, so views showing it do not render again; when one row changes, the other rows keep their objects and
 * the changed row stays the object that was loaded. Only arrays and plain objects are compared.
 */
export const shareEqualValue = <T>(previous: unknown, next: T): T => {
  if (Object.is(previous, next)) return next;
  if (Array.isArray(previous) && Array.isArray(next)) {
    // Rows with ids are matched by id, so a moved row keeps its object; other items by position.
    const byId =
      previous.every(hasId) && next.every(hasId) ? new Map(previous.map((item) => [item.id, item])) : undefined;
    const shared = next.map((item, index) => shareEqualValue(byId ? byId.get(item.id) : previous[index], item));
    if (shared.length === previous.length && shared.every((item, index) => item === previous[index])) {
      return previous as T;
    }
    shared.forEach((item, index) => {
      if (item !== next[index]) replaceInPlace(next, index, item);
    });
    return next;
  }
  if (isPlainData(previous) && isPlainData(next)) {
    const keys = Object.keys(next);
    const shared = keys.map((key) => [key, shareEqualValue(previous[key], next[key])] as const);
    const same =
      keys.length === Object.keys(previous).length &&
      shared.every(([key, value]) => Object.hasOwn(previous, key) && value === previous[key]);
    if (same) return previous as T;
    for (const [key, value] of shared) if (value !== next[key]) replaceInPlace(next, key, value);
    return next;
  }
  return next;
};
