import { describe, expect, it } from "bun:test";
import { resolveSnoozeUntil } from "./parse-snooze";

describe("resolveSnoozeUntil", () => {
  const now = new Date("2026-06-24T10:00:00.000Z");

  it("supports minute durations", () => {
    expect(resolveSnoozeUntil("30m", now)).toBe("2026-06-24T10:30:00.000Z");
  });

  it("supports hour durations", () => {
    expect(resolveSnoozeUntil("2h", now)).toBe("2026-06-24T12:00:00.000Z");
  });

  it("supports day durations", () => {
    expect(resolveSnoozeUntil("1d", now)).toBe("2026-06-25T10:00:00.000Z");
  });

  it("accepts absolute ISO timestamps", () => {
    expect(resolveSnoozeUntil("2026-06-24T15:00:00Z", now)).toBe("2026-06-24T15:00:00.000Z");
  });

  it("throws on invalid input", () => {
    expect(() => resolveSnoozeUntil("not-a-date", now)).toThrow();
  });
});
