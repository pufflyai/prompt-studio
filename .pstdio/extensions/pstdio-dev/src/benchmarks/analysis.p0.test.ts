import { describe, expect, test } from "bun:test";
import {
  buildComparison,
  buildRunResults,
  buildTrends,
  compareVersions,
  latestReleaseStatus,
  measuredCommits,
} from "./analysis";
import type { BenchmarkResultFile } from "./result-file";
import type { CachedResult, RunRecord } from "./store";

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
      ["linux-x64"],
    );
    expect(trends.versions).toEqual(["0.10.0", "0.46.0", "0.47.0"]);
    const [coldStart] = trends.trends[0].metrics;
    expect(coldStart).toMatchObject({ suiteLabel: "Desktop app", label: "Cold start", unit: "ms", budget: 8000 });
    expect(coldStart.points.map((point) => point?.median)).toEqual([5300, 5400, 6500]);
    expect(coldStart.points[0]?.change).toBeUndefined();
    expect(coldStart.points[1]?.change?.verdict).toBe("unchanged");
    expect(coldStart.points[2]?.change?.verdict).toBe("regressed");
  });

  test("lists a metric measured only on another platform without points", () => {
    const relay = release("0.46.0", 5400, "linux-x64");
    relay.file.metrics[0] = { ...relay.file.metrics[0], metric: "relay/stored", label: "Storage bound" };
    const trends = buildTrends([relay, release("0.46.0", 9000, "win32-x64")], ["win32-x64"]);
    const stored = trends.trends[0].metrics.find((metric) => metric.label === "Storage bound");
    expect(stored?.points).toEqual([null]);
  });

  test("puts every platform on one version axis with gaps where it has no results", () => {
    const trends = buildTrends(
      [release("0.45.0", 5000), release("0.46.0", 5400), release("0.46.0", 9000, "win32-x64")],
      ["linux-x64", "win32-x64"],
    );
    expect(trends.versions).toEqual(["0.45.0", "0.46.0"]);
    const [linux, windows] = trends.trends;
    expect(linux.metrics[0].points.map((point) => point?.median)).toEqual([5000, 5400]);
    expect(windows.metrics[0].points.map((point) => point?.median)).toEqual([undefined, 9000]);
    expect(windows.metrics.map((metric) => metric.label)).toEqual(linux.metrics.map((metric) => metric.label));
  });

  test("leaves a gap where a release did not measure a metric", () => {
    const missing = release("0.46.0", 5400);
    missing.file.metrics = [];
    const [linux] = buildTrends([release("0.45.0", 5400), missing, release("0.47.0", 5400)], ["linux-x64"]).trends;
    expect(linux.metrics[0].points.map((point) => point === null)).toEqual([false, true, false]);
    expect(linux.metrics[0].points[2]?.change).toBeUndefined();
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
    expect(measuredCommits([run("100", "base", 5000)], ["linux-x64"])).toEqual(new Set(["base"]));
  });

  test("one sample per commit shows the difference without a verdict", () => {
    const once = (sha: string, value: number): CachedResult => {
      const result = run("400", sha, value);
      result.file.metrics[0].values = [value];
      return result;
    };
    const comparison = buildComparison([once("base", 100), once("head", 110)], "base", "head", "linux-x64");
    expect(comparison.rows[0].change).toMatchObject({ change: expect.closeTo(0.1, 5), verdict: "inconclusive" });
  });

  test("reads the head's own results when no base is chosen", () => {
    const comparison = buildComparison([run("100", "head", 5000)], "", "head", "linux-x64");
    expect(comparison).toMatchObject({ hasBase: false, hasHead: true });
    expect(comparison.rows[0]).toMatchObject({ base: null, change: null, budget: 8000 });
  });
});

describe("measured commits", () => {
  test("counts a commit as measured only when every platform has every chosen suite", () => {
    const results = [run("100", "both", 5000), run("100", "linux-only", 5000)];
    const windows = run("101", "both", 9000);
    windows.file.platform = "win32-x64";
    results.push(windows);
    expect(measuredCommits(results, ["linux-x64", "win32-x64"])).toEqual(new Set(["both"]));
    expect(measuredCommits(results, ["linux-x64"], ["desktop"])).toEqual(new Set(["both", "linux-only"]));
    expect(measuredCommits(results, ["linux-x64"], ["desktop", "storage"])).toEqual(new Set());
  });
});

describe("run results and release status", () => {
  test("reads one run's measurements and names platforms without results", () => {
    const read = buildRunResults([run("100", "base", 5000), run("200", "head", 5000)], "100", [
      "linux-x64",
      "win32-x64",
    ]);
    expect(read.results.map((entry) => entry.commit.sha)).toEqual(["base"]);
    expect(read.results[0].metrics[0]).toMatchObject({ label: "Cold start", samples: 10, overBudget: false });
    expect(read.missingPlatforms).toEqual(["win32-x64"]);
  });

  test("names a release's running and missing platforms, and nothing once all have results", () => {
    const platforms = ["linux-x64", "win32-x64", "darwin-arm64"];
    const releases = [
      { version: "0.45.0", publishedAt: "2026-10-22", platforms: [] },
      { version: "0.46.0", publishedAt: "2026-11-02", platforms: ["linux-x64"] },
    ];
    const releaseRun: RunRecord = {
      id: "9",
      title: "Benchmarks pstdio@0.46.0 on linux-x64,win32-x64",
      status: "running",
      commits: [{ ref: "pstdio@0.46.0" }],
      platforms: ["linux-x64", "win32-x64"],
      url: "",
      createdAt: "2026-11-02T10:00:00Z",
      updatedAt: "2026-11-02T10:00:00Z",
      synced: false,
    };
    expect(latestReleaseStatus(releases, [releaseRun], platforms)).toEqual({
      version: "0.46.0",
      finished: ["linux-x64"],
      running: ["win32-x64"],
      missing: ["darwin-arm64"],
    });
    const complete = [{ version: "0.46.0", publishedAt: "2026-11-02", platforms }];
    expect(latestReleaseStatus(complete, [], platforms)).toBeUndefined();
  });
});
