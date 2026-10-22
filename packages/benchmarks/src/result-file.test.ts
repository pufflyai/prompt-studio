import { describe, expect, test } from "bun:test";
import { mergeSamples } from "./result-file";

const line = (metric: string, value: number, budget?: number) =>
  JSON.stringify({ metric, label: metric, unit: "ms", value, ...(budget === undefined ? {} : { budget }) });

describe("merging samples", () => {
  test("collects every sample of a metric into one series", () => {
    const metrics = mergeSamples([
      { suite: "launch", lines: `${line("cold-start", 5400, 8000)}\n${line("warm-attach", 1700)}\n` },
      { suite: "launch", lines: `${line("cold-start", 5300, 8000)}\n${line("warm-attach", 1650)}\n` },
    ]);
    expect(metrics).toEqual([
      { suite: "launch", metric: "cold-start", label: "cold-start", unit: "ms", budget: 8000, values: [5400, 5300] },
      { suite: "launch", metric: "warm-attach", label: "warm-attach", unit: "ms", values: [1700, 1650] },
    ]);
  });

  test("keeps one value per sample: the median of that sample's measurements", () => {
    const metrics = mergeSamples([
      { suite: "subnav", lines: [line("open", 10), line("open", 30), line("open", 12)].join("\n") },
      { suite: "subnav", lines: [line("open", 20), line("open", 22)].join("\n") },
    ]);
    expect(metrics[0].values).toEqual([12, 21]);
  });

  test("keeps metrics with the same name in different suites apart", () => {
    const metrics = mergeSamples([
      { suite: "storage", lines: line("peak-memory", 1) },
      { suite: "relay", lines: line("peak-memory", 2) },
    ]);
    expect(metrics.map((metric) => `${metric.suite}:${metric.values}`)).toEqual(["storage:1", "relay:2"]);
  });
});
