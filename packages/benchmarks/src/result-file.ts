import type { BenchmarkMeasurement, BenchmarkUnit } from "./writer";

// Readers outside this repository depend on this shape. Change it only together with RESULT_FORMAT.
export const RESULT_FORMAT = 1;

export interface BenchmarkMetricResult {
  suite: string;
  metric: string;
  label: string;
  unit: BenchmarkUnit;
  budget?: number;
  values: number[];
}

export interface BenchmarkSuiteInfo {
  id: string;
  label: string;
  source: string;
}

export interface BenchmarkResultFile {
  format: typeof RESULT_FORMAT;
  commit: { sha: string; ref?: string };
  platform: string;
  runner: string;
  run?: { id: string; url: string };
  startedAt: string;
  finishedAt: string;
  suites: BenchmarkSuiteInfo[];
  metrics: BenchmarkMetricResult[];
}

export interface SuiteSample {
  suite: string;
  lines: string;
}

// Raw samples are kept, so readers can compute their own statistics without running benchmarks again.
export const mergeSamples = (samples: SuiteSample[]) => {
  const metrics = new Map<string, BenchmarkMetricResult>();
  for (const sample of samples) {
    for (const line of sample.lines.split("\n")) {
      if (!line.trim()) continue;
      const measurement = JSON.parse(line) as BenchmarkMeasurement;
      const key = `${sample.suite}/${measurement.metric}`;
      const metric = metrics.get(key) ?? {
        suite: sample.suite,
        metric: measurement.metric,
        label: measurement.label,
        unit: measurement.unit,
        ...(measurement.budget === undefined ? {} : { budget: measurement.budget }),
        values: [],
      };
      metric.values.push(measurement.value);
      metrics.set(key, metric);
    }
  }
  return [...metrics.values()];
};
