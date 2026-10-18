import type { SerializedError } from "./types/commands";

export const serializeCommandError = (error: unknown) => {
  const ancestors: object[] = [];
  const shape = (value: Error) => ({
    ...value,
    name: value.name,
    message: value.message,
    ...(value.stack ? { stack: value.stack } : {}),
    ...(value.cause !== undefined ? { cause: value.cause } : {}),
  });
  const shapes = new WeakMap<Error, ReturnType<typeof shape>>();
  const errorShape = (value: Error) => {
    const existing = shapes.get(value);
    if (existing) return existing;
    const result = shape(value);
    shapes.set(value, result);
    return result;
  };
  const source = error instanceof Error ? errorShape(error) : { message: String(error) };
  const result: SerializedError = JSON.parse(
    JSON.stringify(source, function (this: unknown, _key, value: unknown) {
      const normalized = value instanceof Error ? errorShape(value) : value;
      if (typeof normalized === "bigint") return String(normalized);
      if (normalized && typeof normalized === "object") {
        while (ancestors.length && ancestors.at(-1) !== this) ancestors.pop();
        if (ancestors.includes(normalized)) return "[Circular]";
        ancestors.push(normalized);
      }
      return normalized;
    }),
  );
  return result;
};
