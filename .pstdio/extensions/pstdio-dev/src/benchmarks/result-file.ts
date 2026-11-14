// Mirrors packages/benchmarks/src/result-file.ts. Extensions import only public packages, so this
// reader keeps its own copy of the file contract and checks the format version before trusting it.
export type BenchmarkUnit = "ms" | "share" | "percent" | "bytes" | "count";

export interface BenchmarkMetricResult {
  suite: string;
  metric: string;
  label: string;
  unit: BenchmarkUnit;
  budget?: number;
  values: number[];
  maximum?: number;
  identity?: Record<string, unknown>;
}

export interface BenchmarkSuiteInfo {
  id: string;
  label: string;
  source: string;
}

export interface BenchmarkResultFile {
  format: 1 | 2;
  qualification?: string;
  commit: { sha: string; ref?: string };
  platform: string;
  runner: string;
  run?: { id: string; url: string };
  startedAt: string;
  finishedAt: string;
  suites: BenchmarkSuiteInfo[];
  metrics: BenchmarkMetricResult[];
}

export const parseResultFile = (text: string) => {
  const file = JSON.parse(text) as BenchmarkResultFile;
  if (file.format !== 1 && file.format !== 2)
    throw new Error(`Unsupported benchmark result format ${String(file.format)}.`);
  if (
    file.format === 2 &&
    file.metrics.some(
      (metric) =>
        !metric.identity ||
        !metric.values.length ||
        metric.values.some((value) => !Number.isFinite(value)) ||
        metric.maximum !== Math.max(...metric.values),
    )
  )
    throw new Error("Incomplete format-2 workload identity or raw observations");
  return file;
};
