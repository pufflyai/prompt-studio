import { expect, test } from "bun:test";
import { etaSeries, releaseEta } from "./release-eta";
import type { ReleaseHealth } from "./types";

const run = (id: number, createdAt: string, failedCategories?: ReleaseHealth["failedCategories"], failed = 0) =>
  ({
    id,
    attempt: 1,
    createdAt,
    sha: `sha${id}`,
    url: "",
    title: "",
    status: "completed",
    conclusion: "failure",
    counts: { passed: 10, failed, skipped: 0, reports: 1 },
    failedCategories,
    testJobs: 1,
    reportedJobs: 1,
    pendingJobs: 0,
    failedJobs: [],
    published: false,
    errors: [],
  }) satisfies ReleaseHealth;

test("ETA multiplies blocking failures by agentic hours per category and ignores non-blocking lanes", () => {
  const eta = releaseEta(
    run(1, "2026-11-20T03:00:00Z", { "end-to-end": 4, backend: 2, quarantine: 3, performance: 5 }),
  );
  expect(eta.blocking).toBe(6);
  expect(eta.hours).toBe(4 * 0.75 + 2 * 0.5);
  expect(eta.estimated).toBe(false);
  const legacy = releaseEta(run(2, "2026-11-20T03:00:00Z", undefined, 10));
  expect(legacy).toMatchObject({ blocking: 10, hours: 6, estimated: true });
});

test("grouping by hour keeps the latest finished run of each hour", () => {
  const runs = [
    run(1, "2026-11-20T03:05:00Z", { "end-to-end": 8 }),
    run(2, "2026-11-20T03:40:00Z", { "end-to-end": 2 }),
    run(3, "2026-11-20T05:10:00Z", {}),
  ];
  const hourly = etaSeries(runs, "hour");
  expect(hourly.map((point) => [point.key, point.latest.run.id, point.runs])).toEqual([
    ["2026-11-20T03:00Z", 2, 2],
    ["2026-11-20T05:00Z", 3, 1],
  ]);
  expect(etaSeries(runs, "run")).toHaveLength(3);
  expect(etaSeries(runs, "day").map((point) => point.latest.hours)).toEqual([0]);
});
