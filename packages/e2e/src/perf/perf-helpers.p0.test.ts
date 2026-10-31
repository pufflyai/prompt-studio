import { describe, expect, it } from "bun:test";
import { budgetMisses, summarizeSamples } from "./perf-helpers";

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
