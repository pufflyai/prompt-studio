import { describe, expect, it } from "bun:test";
import { summarizeSamples } from "./perf-helpers";

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
