import type { RuntimeErrorPayload } from "./contract";

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const safeStringify = (value: unknown) => {
  try {
    const json = JSON.stringify(value);
    if (typeof json === "string" && json.length > 0) return json;
  } catch {
    // Circular or non-serializable — fall through.
  }
  try {
    return String(value);
  } catch {
    return "Unknown error";
  }
};

export const normalizeRuntimeError = (value: unknown): RuntimeErrorPayload => {
  if (value instanceof Error) return { message: value.message, stack: value.stack };

  if (typeof value === "string") return { message: value };

  if (isRecord(value)) {
    const message = typeof value.message === "string" ? value.message : null;
    const stack = typeof value.stack === "string" ? value.stack : undefined;
    if (message) return stack ? { message, stack } : { message };
    return { message: safeStringify(value) };
  }

  if (value === null || value === undefined) return { message: "Unknown error" };

  return { message: safeStringify(value) };
};
