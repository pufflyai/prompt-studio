import { describe, expect, test } from "bun:test";
import { createInMemoryWatermarkStore, floorToMinute, parseWatermarks } from "./watermark-store";

describe("watermark helpers", () => {
  test("floorToMinute returns a Date aligned to the minute", () => {
    const floored = floorToMinute(new Date("2026-01-02T03:04:59.999Z"));
    expect(floored.toISOString()).toBe("2026-01-02T03:04:00.000Z");
  });

  test("parseWatermarks ignores non-finite numbers", () => {
    const raw = JSON.stringify({ a: 1, b: "not a number", c: Number.NaN });
    const parsed = parseWatermarks(raw);
    expect([...parsed.entries()]).toEqual([["a", 1]]);
  });
});

describe("createInMemoryWatermarkStore", () => {
  test("save then load returns a copy of the snapshot", async () => {
    const store = createInMemoryWatermarkStore();
    await store.save(new Map([["a", 1]]));

    const loaded = await store.load();
    loaded.set("a", 99);

    const reloaded = await store.load();
    expect(reloaded.get("a")).toBe(1);
  });
});
