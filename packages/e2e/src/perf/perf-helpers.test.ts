import { describe, expect, it } from "bun:test";
import { calculateStats } from "./perf-helpers";

describe("calculateStats", () => {
  it("reports min, median, percentiles, and max", () => {
    expect(calculateStats([300, 100, 200, 400])).toEqual({
      min: 100,
      median: 200,
      p75: 300,
      p95: 400,
      max: 400,
    });
  });
});
