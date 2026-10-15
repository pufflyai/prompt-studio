import { z } from "zod";

export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

function isJson(value: unknown) {
  try {
    JSON.stringify(value);
  } catch {
    return false;
  }
  const queue = [value];
  const visited = new Set<object>();
  while (queue.length) {
    const item = queue.pop();
    if (item === null || typeof item === "string" || typeof item === "boolean") continue;
    if (typeof item === "number" && Number.isFinite(item)) continue;
    if (typeof item !== "object" || item === null) return false;
    if (visited.has(item)) continue;
    visited.add(item);
    if (Array.isArray(item)) queue.push(...item);
    else {
      const prototype = Object.getPrototypeOf(item);
      if (prototype !== Object.prototype && prototype !== null) return false;
      queue.push(...Object.values(item));
    }
  }
  return true;
}

// Zod's object/record parsers discard special keys. JSON values must retain them.
export const jsonSchema = z.custom<Json>(isJson, "Expected a JSON value without loss of object keys");
export function dictionarySchema<T extends z.ZodType>(valueSchema: T) {
  return z.custom<Record<string, z.infer<T>>>(
    (value) =>
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.values(value).every((entry) => valueSchema.safeParse(entry).success),
    "Invalid dictionary",
  );
}
