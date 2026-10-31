import { afterEach, describe, expect, test } from "bun:test";
import { benchmarkSampleCount } from "./sampling";

const previous = process.env.BENCHMARK_SAMPLES;
afterEach(() => {
  if (previous === undefined) delete process.env.BENCHMARK_SAMPLES;
  else process.env.BENCHMARK_SAMPLES = previous;
});

describe("benchmark sample count", () => {
  test("keeps the standalone workload's default and lets the runner request one sample", () => {
    delete process.env.BENCHMARK_SAMPLES;
    expect(benchmarkSampleCount(30)).toBe(30);
    process.env.BENCHMARK_SAMPLES = "1";
    expect(benchmarkSampleCount(30)).toBe(1);
    process.env.BENCHMARK_SAMPLES = "10";
    expect(benchmarkSampleCount(3)).toBe(10);
  });

  test("rejects zero, negative, fractional and nonnumeric sample counts", () => {
    for (const count of ["0", "-1", "1.5", "no", "Infinity"]) {
      process.env.BENCHMARK_SAMPLES = count;
      expect(() => benchmarkSampleCount(3)).toThrow("BENCHMARK_SAMPLES must be a positive integer");
    }
  });
});
