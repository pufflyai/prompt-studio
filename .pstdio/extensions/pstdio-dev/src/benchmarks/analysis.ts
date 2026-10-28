import type { BenchmarkMetricResult, BenchmarkResultFile, BenchmarkUnit } from "./result-file";
import { compareSamples, summarize } from "./stats";
import type { CachedResult } from "./store";

export type Summary = ReturnType<typeof summarize>;
export type Change = ReturnType<typeof compareSamples>;

export interface MetricKey {
  suite: string;
  suiteLabel: string;
  metric: string;
  label: string;
  unit: BenchmarkUnit;
  budget?: number;
}

export interface TrendPoint extends Summary {
  version: string;
  change?: Change;
}

export interface TrendMetric extends MetricKey {
  points: (TrendPoint | null)[];
}

export interface CompareRow extends MetricKey {
  base: (Summary & { values: number[] }) | null;
  head: (Summary & { values: number[] }) | null;
  change: Change | null;
}

const keyOf = (metric: Pick<BenchmarkMetricResult, "suite" | "metric">) => `${metric.suite}/${metric.metric}`;

const versionParts = (version: string) => version.split(".").map(Number);
export const compareVersions = (a: string, b: string) => {
  const [left, right] = [versionParts(a), versionParts(b)];
  for (let index = 0; index < 3; index++) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
};

const metricKey = (file: BenchmarkResultFile, metric: BenchmarkMetricResult): MetricKey => {
  const suite = file.suites.find((entry) => entry.id === metric.suite);
  return {
    suite: metric.suite,
    suiteLabel: suite?.label ?? metric.suite,
    metric: metric.metric,
    label: metric.label,
    unit: metric.unit,
    ...(metric.budget === undefined ? {} : { budget: metric.budget }),
  };
};

export const platformsOf = (results: CachedResult[]) => [...new Set(results.map((result) => result.file.platform))];

// Keeps the first-seen order of suites and metrics, which follows the runner's suite list.
const collectKeys = (files: BenchmarkResultFile[]) => {
  const keys = new Map<string, MetricKey>();
  for (const file of files) {
    for (const metric of file.metrics) keys.set(keyOf(metric), metricKey(file, metric));
  }
  return keys;
};

export const buildTrends = (results: CachedResult[], platform: string) => {
  const releases = results
    .flatMap((result) =>
      result.source.kind === "release" && result.file.platform === platform
        ? [{ version: result.source.version, file: result.file }]
        : [],
    )
    .sort((a, b) => compareVersions(a.version, b.version));
  // Metrics measured only on other platforms stay listed, so the page can say they are not measured here.
  // This platform's files come last, so their budgets win.
  const elsewhere = results.filter((result) => result.source.kind === "release" && result.file.platform !== platform);
  const files = [...elsewhere.map((result) => result.file), ...releases.map((release) => release.file)];
  const metrics = [...collectKeys(files)].map(([key, info]): TrendMetric => {
    let previous: number[] | undefined;
    const points = releases.map((release) => {
      const values = release.file.metrics.find((metric) => keyOf(metric) === key)?.values;
      if (!values?.length) {
        previous = undefined;
        return null;
      }
      const point: TrendPoint = { version: release.version, ...summarize(values) };
      if (previous) point.change = compareSamples(previous, values);
      previous = values;
      return point;
    });
    return { ...info, points };
  });
  return { versions: releases.map((release) => release.version), metrics };
};

const runIdOf = (result: CachedResult) => (result.source.kind === "run" ? result.source.runId : undefined);

// A run that measured both commits side by side is the fairest comparison, so it wins over the
// newest separate measurements of each commit.
const pickFiles = (results: CachedResult[], base: string, head: string) => {
  const newestFirst = [...results].sort((a, b) => Number(runIdOf(b) ?? 0) - Number(runIdOf(a) ?? 0));
  const baseRuns = new Set(newestFirst.filter((result) => result.file.commit.sha === base).map(runIdOf));
  const shared = newestFirst.find(
    (result) => result.file.commit.sha === head && runIdOf(result) && baseRuns.has(runIdOf(result)),
  );
  const fileFor = (sha: string) =>
    newestFirst.find((result) => result.file.commit.sha === sha && (!shared || runIdOf(result) === runIdOf(shared)))
      ?.file;
  return { base: fileFor(base), head: fileFor(head) };
};

export const buildComparison = (results: CachedResult[], base: string, head: string, platform: string) => {
  const files = pickFiles(
    results.filter((result) => result.file.platform === platform),
    base,
    head,
  );
  const present = [files.base, files.head].filter((file): file is BenchmarkResultFile => Boolean(file));
  const rows = [...collectKeys(present)].map(([key, info]): CompareRow => {
    const baseValues = files.base?.metrics.find((metric) => keyOf(metric) === key)?.values;
    const headValues = files.head?.metrics.find((metric) => keyOf(metric) === key)?.values;
    return {
      ...info,
      base: baseValues?.length ? { ...summarize(baseValues), values: baseValues } : null,
      head: headValues?.length ? { ...summarize(headValues), values: headValues } : null,
      change: baseValues?.length && headValues?.length ? compareSamples(baseValues, headValues) : null,
    };
  });
  return { hasBase: Boolean(files.base), hasHead: Boolean(files.head), rows };
};

// Commits with results, so the picker can say which ones are ready to compare on this platform.
export const measuredCommits = (results: CachedResult[], platform: string) =>
  new Set(results.filter((result) => result.file.platform === platform).map((result) => result.file.commit.sha));
