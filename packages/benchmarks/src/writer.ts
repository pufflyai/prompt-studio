import { appendFileSync } from "node:fs";

// Lower is better for every unit, so one comparison rule covers time, CPU share, and memory.
export type BenchmarkUnit = "ms" | "share" | "percent" | "bytes";

export interface BenchmarkMeasurement {
  metric: string;
  label: string;
  unit: BenchmarkUnit;
  value: number;
  budget?: number;
}

export const RESULTS_FILE_ENV = "BENCHMARK_RESULTS";

// Benchmarks also run on their own. Measurements are kept only when the runner names a results file.
export const recordMeasurement = (measurement: BenchmarkMeasurement) => {
  const file = process.env[RESULTS_FILE_ENV];
  if (!file) return;
  appendFileSync(file, `${JSON.stringify(measurement)}\n`);
};

// resourceUsage reports kilobytes. Call it after the workload, because the value is a lifetime peak.
export const recordPeakMemory = (metric: string, label: string) =>
  recordMeasurement({ metric, label, unit: "bytes", value: process.resourceUsage().maxRSS * 1024 });
