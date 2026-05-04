import { describe, expect, test } from "bun:test";
import { findCatchupMinute } from "./catchup";
import { toMinuteEpoch } from "./watermark-store";

describe("findCatchupMinute", () => {
  test("returns null when no watermark is recorded", () => {
    const result = findCatchupMinute({
      cron: "* * * * *",
      lastWatermark: undefined,
      nowMinute: new Date("2026-04-20T09:05:00.000Z"),
    });
    expect(result).toBeNull();
  });

  test("returns null when the last cron tick equals nowMinute", () => {
    const lastWatermark = toMinuteEpoch(new Date("2026-04-20T09:04:00.000Z"));
    const result = findCatchupMinute({
      cron: "* * * * *",
      lastWatermark,
      nowMinute: new Date("2026-04-20T09:05:00.000Z"),
    });
    expect(result).toBeNull();
  });

  test("returns the most recent missed cron minute for a frequent schedule", () => {
    const lastWatermark = toMinuteEpoch(new Date("2026-04-20T09:00:00.000Z"));
    const result = findCatchupMinute({
      cron: "* * * * *",
      lastWatermark,
      nowMinute: new Date("2026-04-20T09:05:00.000Z"),
    });
    expect(result?.toISOString()).toBe("2026-04-20T09:04:00.000Z");
  });

  test("returns the latest missed cron minute for a sparse schedule", () => {
    const lastWatermark = toMinuteEpoch(new Date("2026-02-01T00:00:00.000Z"));
    const result = findCatchupMinute({
      cron: "0 0 1 * *",
      lastWatermark,
      nowMinute: new Date("2026-04-20T09:00:00.000Z"),
    });
    expect(result?.toISOString()).toBe("2026-04-01T00:00:00.000Z");
  });

  test("returns null when watermark equals or exceeds the last missed minute", () => {
    const lastWatermark = toMinuteEpoch(new Date("2026-04-01T00:00:00.000Z"));
    const result = findCatchupMinute({
      cron: "0 0 1 * *",
      lastWatermark,
      nowMinute: new Date("2026-04-20T09:00:00.000Z"),
    });
    expect(result).toBeNull();
  });
});
