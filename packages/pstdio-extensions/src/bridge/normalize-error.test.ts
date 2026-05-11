import { describe, expect, test } from "bun:test";
import { normalizeRuntimeError } from "./normalize-error";

describe("normalizeRuntimeError", () => {
  test("preserves message and stack from Error instances", () => {
    const error = new Error("boom");
    const payload = normalizeRuntimeError(error);
    expect(payload.message).toBe("boom");
    expect(payload.stack).toBe(error.stack);
  });

  test("uses message and stack from RuntimeErrorPayload-shaped objects", () => {
    const payload = normalizeRuntimeError({ message: "guest failed", stack: "at foo" });
    expect(payload).toEqual({ message: "guest failed", stack: "at foo" });
  });

  test("uses message when stack is missing", () => {
    const payload = normalizeRuntimeError({ message: "guest failed" });
    expect(payload.message).toBe("guest failed");
    expect(payload.stack).toBeUndefined();
  });

  test("treats string throws as the message", () => {
    expect(normalizeRuntimeError("kaput").message).toBe("kaput");
  });

  test("falls back to JSON for plain objects without a message", () => {
    const payload = normalizeRuntimeError({ code: 500, reason: "ENOENT" });
    expect(payload.message).toBe('{"code":500,"reason":"ENOENT"}');
  });

  test("handles circular objects without throwing", () => {
    const value: Record<string, unknown> = { code: 500 };
    value.self = value;
    const payload = normalizeRuntimeError(value);
    expect(typeof payload.message).toBe("string");
    expect(payload.message.length).toBeGreaterThan(0);
  });

  test("reports a generic message for null and undefined", () => {
    expect(normalizeRuntimeError(undefined).message).toBe("Unknown error");
    expect(normalizeRuntimeError(null).message).toBe("Unknown error");
  });
});
