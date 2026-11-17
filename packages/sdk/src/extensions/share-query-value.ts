const shareable = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== "object") return false;
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype) return false;
  const keys = Object.keys(value);
  if (Array.isArray(value) && keys.some((key, index) => key !== String(index))) return false;
  const expected = Array.isArray(value) ? value.length + 1 : keys.length;
  if (Reflect.ownKeys(value).length !== expected) return false;
  return keys.every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    return descriptor.enumerable && "value" in descriptor;
  });
};

/** Share ordinary query data while treating provider symbols, accessors and class instances as opaque. */
export const shareQueryValue = <T>(previous: unknown, next: T): T => {
  if (previous === next) return next;
  if (!shareable(previous) || !shareable(next) || Array.isArray(previous) !== Array.isArray(next)) return next;
  const keys = Object.keys(next);
  let equal = Object.keys(previous).length === keys.length;
  const result = (Array.isArray(next) ? [...next] : { ...next }) as Record<string, unknown>;
  for (const key of keys) {
    const value = shareQueryValue(previous[key], next[key]);
    result[key] = value;
    if (!Object.hasOwn(previous, key) || previous[key] !== value) equal = false;
  }
  return (equal ? previous : result) as T;
};
