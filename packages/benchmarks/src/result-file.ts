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

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

// A sample is one run of a suite on one commit. Statistics resample whole samples, so a metric
// measured several times within one sample contributes that sample's median, keeping one value per
// sample in run order.
export const mergeSamples = (samples: SuiteSample[]) => {
  const metrics = new Map<string, BenchmarkMetricResult>();
  for (const sample of samples) {
    const measured = new Map<string, { measurement: BenchmarkMeasurement; values: number[] }>();
    for (const line of sample.lines.split("\n")) {
      if (!line.trim()) continue;
      const measurement = JSON.parse(line) as BenchmarkMeasurement;
      const entry = measured.get(measurement.metric) ?? { measurement, values: [] };
      entry.values.push(measurement.value);
      measured.set(measurement.metric, entry);
    }
    for (const { measurement, values } of measured.values()) {
      const key = `${sample.suite}/${measurement.metric}`;
      const metric = metrics.get(key) ?? {
        suite: sample.suite,
        metric: measurement.metric,
        label: measurement.label,
        unit: measurement.unit,
        ...(measurement.budget === undefined ? {} : { budget: measurement.budget }),
        values: [],
      };
      metric.values.push(median(values));
      metrics.set(key, metric);
    }
  }
  return [...metrics.values()];
};
