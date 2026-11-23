import { expect, test } from "bun:test";
import { buildHealthTimeline } from "./health-timeline";
import type { ReleaseHealth } from "./types";

const run = (id: number, createdAt: string) => ({ id, createdAt }) as ReleaseHealth;

test("hourly timelines place runs, merges and publications in their own UTC hour up to now", () => {
  const { buckets } = buildHealthTimeline({
    today: "2026-11-20",
    range: "7",
    aggregation: "hour",
    now: Date.parse("2026-11-20T10:30:00Z"),
    runs: [run(1, "2026-11-20T03:05:00Z"), run(2, "2026-11-20T03:55:00Z"), run(3, "2026-11-20T09:01:00Z")],
    merges: [{ date: "2026-11-20", count: 99 }],
    hourlyMerges: [{ date: "2026-11-20T08:00Z", count: 2 }],
    publications: [{ tag: "pstdio@0.48.0-nightly.1", publishedAt: "2026-11-20T09:40:00Z" }],
  });
  const at = (key: string) => buckets.find(({ date }) => date === key)!;
  expect(buckets.at(-1)?.date).toBe("2026-11-20T10:00Z");
  expect(at("2026-11-20T03:00Z").runs.map(({ id }) => id)).toEqual([1, 2]);
  expect(at("2026-11-20T08:00Z").merges?.count).toBe(2);
  expect(at("2026-11-20T09:00Z").runs.map(({ id }) => id)).toEqual([3]);
  expect(at("2026-11-20T09:00Z").publications).toHaveLength(1);
  expect(buckets.reduce((sum, bucket) => sum + (bucket.merges?.count ?? 0), 0)).toBe(2);
});

test("daily timelines keep using daily merges", () => {
  const { buckets } = buildHealthTimeline({
    today: "2026-11-20",
    range: "7",
    aggregation: "day",
    runs: [run(1, "2026-11-20T03:05:00Z")],
    merges: [{ date: "2026-11-20", count: 5 }],
    hourlyMerges: [{ date: "2026-11-20T08:00Z", count: 2 }],
    publications: [],
  });
  expect(buckets.at(-1)).toMatchObject({ date: "2026-11-20", merges: { count: 5 } });
  expect(buckets.at(-1)?.runs).toHaveLength(1);
});
