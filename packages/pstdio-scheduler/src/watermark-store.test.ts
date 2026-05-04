import { describe, expect, test } from "bun:test";
import {
  createInMemoryWatermarkStore,
  floorToMinute,
  parseWatermarks,
  serializeWatermarks,
  toMinuteEpoch,
} from "./watermark-store";

describe("watermark helpers", () => {
  test("toMinuteEpoch floors to the minute", () => {
    expect(toMinuteEpoch(new Date("2026-01-02T03:04:59.999Z"))).toBe(
      Math.floor(new Date("2026-01-02T03:04:00.000Z").getTime() / 60_000),
    );
  });

  test("floorToMinute returns a Date aligned to the minute", () => {
    const floored = floorToMinute(new Date("2026-01-02T03:04:59.999Z"));
    expect(floored.toISOString()).toBe("2026-01-02T03:04:00.000Z");
  });

  test("serializeWatermarks/parseWatermarks round-trip with sorted keys", () => {
    const watermarks = new Map([
      ["b", 2],
      ["a", 1],
      ["c", 3],
    ]);

    const serialized = serializeWatermarks(watermarks);
    expect(serialized.endsWith("\n")).toBe(true);
    expect(serialized).toBe(`{\n  "a": 1,\n  "b": 2,\n  "c": 3\n}\n`);

    const parsed = parseWatermarks(serialized);
    expect([...parsed.entries()]).toEqual([
      ["a", 1],
      ["b", 2],
      ["c", 3],
    ]);
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
