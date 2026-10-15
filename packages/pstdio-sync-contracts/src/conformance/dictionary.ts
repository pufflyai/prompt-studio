export function own<T>(values: Record<string, T>, key: string) {
  return Object.hasOwn(values, key) ? values[key] : undefined;
}
export function put<T>(values: Record<string, T>, key: string, value: T) {
  Object.defineProperty(values, key, { value, enumerable: true, configurable: true, writable: true });
}
