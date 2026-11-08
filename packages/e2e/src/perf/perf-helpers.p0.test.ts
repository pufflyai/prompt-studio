import { describe, expect, it } from "bun:test";
import { budgetMisses, summarizeInteraction, summarizeSamples } from "./perf-helpers";

it("counts the long task containing the input event, excluding work outside the interaction", () => {
  expect(
    summarizeInteraction({
      start: 100,
      settled: 800,
      longTasks: [
        { startTime: 10, duration: 90 },
        { startTime: 99, duration: 633 },
        { startTime: 750, duration: 60 },
        { startTime: 800, duration: 80 },
      ],
    }),
  ).toEqual({ duration: 700, longTasks: [633, 60] });
});

describe("summarizeSamples", () => {
  it("reports every sample with the median and range", () => {
    expect(summarizeSamples([300, 100, 200, 400])).toEqual({
      samples: [300, 100, 200, 400],
      min: 100,
      median: 250,
      max: 400,
    });
  });

  it("uses the middle sample as the median of an odd count", () => {
    expect(summarizeSamples([30, 10, 20]).median).toBe(20);
  });
});

describe("benchmark budget checks", () => {
  it("rejects equality under the approved strictly-below rule", () => {
    expect(budgetMisses("example", "open", [150], 150)).toHaveLength(1);
    expect(budgetMisses("example", "open", [149], 150)).toEqual([]);
  });

  it("reports missing measurements instead of a healthy zero", () => {
    expect(budgetMisses("example", "open", [Number.NaN], 150)).toEqual(["example open was not measured"]);
    expect(budgetMisses("example", "open", [], 150)).toEqual(["No measurements were recorded"]);
  });
});
