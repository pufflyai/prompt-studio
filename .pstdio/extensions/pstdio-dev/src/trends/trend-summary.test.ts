import { describe, expect, test } from "bun:test";
import type { TrendMetric, TrendPoint } from "../benchmarks/analysis";
import { groupBySuite, versionSummary } from "./trend-summary";

const point = (median: number, verdict?: "improved" | "regressed" | "unchanged"): TrendPoint => ({
  version: "0.46.0",
  median,
  low: median * 0.95,
  high: median * 1.05,
  samples: 10,
  ...(verdict ? { change: { change: 0, low: 0, high: 0, verdict } } : {}),
});

const metric = (suite: string, label: string, points: (TrendPoint | null)[], budget?: number): TrendMetric => ({
  suite,
  suiteLabel: suite,
  source: "",
  metric: label,
  label,
  unit: "ms",
  points,
  ...(budget === undefined ? {} : { budget }),
});

describe("version summary", () => {
  test("counts changes and budget misses in the chosen version only", () => {
    const metrics = [
      metric("desktop", "Cold start", [point(5000), point(9000, "regressed")], 8000),
      metric("desktop", "Warm attach", [point(1000), point(800, "improved")], 3000),
      metric("storage", "Record save", [point(1), null]),
    ];
    expect(versionSummary(metrics, 1)).toEqual({ improved: 1, regressed: 1, overBudget: 1, budgeted: 2 });
    expect(versionSummary(metrics, 0)).toEqual({ improved: 0, regressed: 0, overBudget: 0, budgeted: 2 });
  });

  test("groups metrics by suite in their original order", () => {
    const groups = groupBySuite([metric("desktop", "a", []), metric("storage", "b", []), metric("desktop", "c", [])]);
    expect(groups.map((group) => [group.suite, group.metrics.map((entry) => entry.label)])).toEqual([
      ["desktop", ["a", "c"]],
      ["storage", ["b"]],
    ]);
  });
});
