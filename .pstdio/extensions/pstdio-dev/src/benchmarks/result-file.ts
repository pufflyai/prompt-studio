// Mirrors packages/benchmarks/src/result-file.ts. Extensions import only public packages, so this
// reader keeps its own copy of the file contract and checks the format version before trusting it.
export type BenchmarkUnit = "ms" | "share" | "percent" | "bytes";

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
  format: 1;
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
  if (file.format !== 1) throw new Error(`Unsupported benchmark result format ${String(file.format)}.`);
  return file;
};
