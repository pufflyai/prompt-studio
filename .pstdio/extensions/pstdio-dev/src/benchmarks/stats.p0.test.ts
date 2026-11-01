import { describe, expect, test } from "bun:test";
import { compareSamples, median, summarize } from "./stats";

const base = [100, 102, 98, 101, 99, 103, 97, 100, 101, 99];

describe("benchmark statistics", () => {
  test("median ignores a single outlier", () => {
    expect(median([10, 11, 12, 13, 900])).toBe(12);
    expect(median([10, 12, 14, 16])).toBe(13);
  });

  test("the confidence interval surrounds the median and narrows with stable samples", () => {
    const noisy = summarize([80, 120, 95, 105, 70, 130, 100, 90, 110, 100]);
    const stable = summarize(base);
    expect(stable.low).toBeLessThanOrEqual(stable.median);
    expect(stable.high).toBeGreaterThanOrEqual(stable.median);
    expect(stable.high - stable.low).toBeLessThan(noisy.high - noisy.low);
    expect(stable.samples).toBe(10);
  });

  test("the same samples always give the same interval", () => {
    expect(summarize(base)).toEqual(summarize(base));
  });

  test("a clear increase is a regression and a clear decrease an improvement", () => {
    const slower = compareSamples(
      base,
      base.map((value) => value * 1.2),
    );
    expect(slower.verdict).toBe("regressed");
    expect(slower.change).toBeCloseTo(0.2, 5);
    expect(slower.low).toBeGreaterThan(0);

    expect(
      compareSamples(
        base,
        base.map((value) => value * 0.8),
      ).verdict,
    ).toBe("improved");
  });

  test("an idle zero stays comparable instead of dividing by zero", () => {
    expect(compareSamples([0, 0, 0], [0, 0, 0])).toEqual({ change: 0, low: 0, high: 0, verdict: "unchanged" });
    const fromZero = compareSamples([0, 0, 0, 0], [0.4, 0.5, 0.6, 0.5]);
    expect(fromZero.verdict).toBe("regressed");
    expect(fromZero.change).toBe(Number.POSITIVE_INFINITY);
  });

  test("one sample per side has a difference but no interval or verdict", () => {
    expect(compareSamples([100], [110])).toEqual({
      change: expect.closeTo(0.1, 5),
      low: expect.closeTo(0.1, 5),
      high: expect.closeTo(0.1, 5),
      verdict: "inconclusive",
    });
    expect(compareSamples(base, [110]).verdict).toBe("inconclusive");
  });

  test("a change inside the noise is unchanged", () => {
    const result = compareSamples(base, [101, 99, 100, 102, 98, 100, 103, 97, 100, 101]);
    expect(result.verdict).toBe("unchanged");
    expect(result.low).toBeLessThan(0);
    expect(result.high).toBeGreaterThan(0);
  });
});
