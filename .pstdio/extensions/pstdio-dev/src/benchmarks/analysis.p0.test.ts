import { describe, expect, test } from "bun:test";
import { buildComparison, buildTrends, compareVersions, measuredCommits } from "./analysis";
import type { BenchmarkResultFile } from "./result-file";
import type { CachedResult } from "./store";

const noise = [1, 1.02, 0.98, 1.01, 0.99, 1.03, 0.97, 1, 1.01, 0.99];

const file = (sha: string, coldStart: number, platform = "linux-x64"): BenchmarkResultFile => ({
  format: 1,
  commit: { sha },
  platform,
  runner: "ubuntu-24.04",
  startedAt: "2026-10-20T10:00:00.000Z",
  finishedAt: "2026-10-20T11:00:00.000Z",
  suites: [{ id: "desktop", label: "Desktop app", source: "clients/desktop/src/e2e/packaged-*.bench.ts" }],
  metrics: [
    {
      suite: "desktop",
      metric: "cold-start/cold-start",
      label: "Cold start",
      unit: "ms",
      budget: 8000,
      values: noise.map((factor) => coldStart * factor),
    },
  ],
});

const release = (version: string, coldStart: number, platform?: string): CachedResult => ({
  source: { kind: "release", version },
  file: file(`sha-${version}`, coldStart, platform),
});
const run = (runId: string, sha: string, coldStart: number): CachedResult => ({
  source: { kind: "run", runId },
  file: file(sha, coldStart),
});

describe("trends across releases", () => {
  test("orders releases by version and marks a real slowdown", () => {
    const trends = buildTrends(
      [release("0.47.0", 6500), release("0.46.0", 5400), release("0.10.0", 5300), release("0.46.0", 9000, "win32-x64")],
      "linux-x64",
    );
    expect(trends.versions).toEqual(["0.10.0", "0.46.0", "0.47.0"]);
    const [coldStart] = trends.metrics;
    expect(coldStart).toMatchObject({ suiteLabel: "Desktop app", label: "Cold start", unit: "ms", budget: 8000 });
    expect(coldStart.points.map((point) => point?.median)).toEqual([5300, 5400, 6500]);
    expect(coldStart.points[0]?.change).toBeUndefined();
    expect(coldStart.points[1]?.change?.verdict).toBe("unchanged");
    expect(coldStart.points[2]?.change?.verdict).toBe("regressed");
  });

  test("lists a metric measured only on another platform without points", () => {
    const relay = release("0.46.0", 5400, "linux-x64");
    relay.file.metrics[0] = { ...relay.file.metrics[0], metric: "relay/stored", label: "Storage bound" };
    const trends = buildTrends([relay, release("0.46.0", 9000, "win32-x64")], "win32-x64");
    const stored = trends.metrics.find((metric) => metric.label === "Storage bound");
    expect(stored?.points).toEqual([null]);
  });

  test("leaves a gap where a release did not measure a metric", () => {
    const missing = release("0.46.0", 5400);
    missing.file.metrics = [];
    const trends = buildTrends([release("0.45.0", 5400), missing, release("0.47.0", 5400)], "linux-x64");
    expect(trends.metrics[0].points.map((point) => point === null)).toEqual([false, true, false]);
    expect(trends.metrics[0].points[2]?.change).toBeUndefined();
  });

  test("compares versions numerically", () => {
    expect(compareVersions("0.9.0", "0.10.0")).toBeLessThan(0);
    expect(compareVersions("1.0.0", "0.99.9")).toBeGreaterThan(0);
  });
});

describe("comparing commits", () => {
  test("prefers the run that measured both commits together", () => {
    const comparison = buildComparison(
      [run("100", "base", 5000), run("100", "head", 6000), run("200", "head", 5000)],
      "base",
      "head",
      "linux-x64",
    );
    expect(comparison.rows[0].head?.median).toBe(6000);
    expect(comparison.rows[0].change?.verdict).toBe("regressed");
  });

  test("falls back to the newest result of each commit", () => {
    const comparison = buildComparison(
      [run("100", "base", 5000), run("200", "head", 4000), run("300", "head", 4500)],
      "base",
      "head",
      "linux-x64",
    );
    expect(comparison.rows[0].head?.median).toBe(4500);
    expect(comparison.rows[0].change?.verdict).toBe("improved");
  });

  test("reports a commit without results", () => {
    const comparison = buildComparison([run("100", "base", 5000)], "base", "head", "linux-x64");
    expect(comparison).toMatchObject({ hasBase: true, hasHead: false });
    expect(comparison.rows[0].change).toBeNull();
    expect(measuredCommits([run("100", "base", 5000)], "linux-x64")).toEqual(new Set(["base"]));
  });
});
