import type { BenchmarkMeasurement, BenchmarkUnit } from "./writer";

// Readers outside this repository depend on this shape. Change it only together with RESULT_FORMAT.
export const RESULT_FORMAT = 2;

export interface BenchmarkMetricResult {
  suite: string;
  metric: string;
  label: string;
  unit: BenchmarkUnit;
  budget?: number;
  values: number[];
  maximum: number;
  identity: Record<string, unknown>;
}

export interface BenchmarkSuiteInfo {
  id: string;
  label: string;
  source: string;
}

export interface BenchmarkResultFile {
  format: typeof RESULT_FORMAT;
  qualification: "qualified" | "unqualified";
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
  qualified?: boolean;
}

// One observation per metric per sample. Keep every raw value and its maximum.
export const mergeSamples = (samples: SuiteSample[]) => {
  const metrics = new Map<string, BenchmarkMetricResult>();
  for (const sample of samples) {
    const seen = new Set<string>();
    for (const line of sample.lines.split("\n").filter((entry) => entry.trim())) {
      const measurement = JSON.parse(line) as BenchmarkMeasurement;
      if (
        seen.has(measurement.metric) ||
        !Number.isFinite(measurement.value) ||
        !measurement.identity ||
        measurement.identity.scenario !== sample.suite
      )
        throw new Error("Duplicate, invalid or unidentified benchmark observation");
      seen.add(measurement.metric);
      const key = `${sample.suite}/${measurement.metric}`;
      const {
        catalogDigest: _catalogDigest,
        source: _source,
        host: _host,
        sample: _sample,
        planDigest: _plan,
        runId: _run,
        executionId: _execution,
        approval: _approval,
        dirty: _dirty,
        ...identity
      } = measurement.identity;
      const metric = metrics.get(key) ?? {
        suite: sample.suite,
        metric: measurement.metric,
        label: measurement.label,
        unit: measurement.unit,
        budget: measurement.budget,
        values: [],
        maximum: measurement.value,
        identity,
      };
      if (
        JSON.stringify(metric.identity) !== JSON.stringify(identity) ||
        metric.budget !== measurement.budget ||
        metric.unit !== measurement.unit
      )
        throw new Error("Cannot combine unlike benchmark workloads or limits");
      metric.values.push(measurement.value);
      metric.maximum = Math.max(metric.maximum, measurement.value);
      metrics.set(key, metric);
    }
    if (!seen.size) throw new Error(`Missing observations for ${sample.suite}`);
  }
  return [...metrics.values()];
};
