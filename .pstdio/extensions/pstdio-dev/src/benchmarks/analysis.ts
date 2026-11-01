import { finished } from "./github";
import type { BenchmarkMetricResult, BenchmarkResultFile, BenchmarkUnit } from "./result-file";
import { compareSamples, median, summarize } from "./stats";
import type { CachedResult, ReleaseRecord, RunRecord } from "./store";

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

export interface PlatformTrend {
  platform: string;
  metrics: TrendMetric[];
}

// Every platform shares one version axis, so their lines can share a chart. A release a platform did not
// measure is a gap on that platform's line, never a zero.
export const buildTrends = (results: CachedResult[], platforms: string[]) => {
  const releases = results
    .flatMap((result) =>
      result.source.kind === "release" ? [{ version: result.source.version, file: result.file }] : [],
    )
    .sort((a, b) => compareVersions(a.version, b.version) || a.file.platform.localeCompare(b.file.platform));
  const versions = [...new Set(releases.map((release) => release.version))];
  const trends = platforms.map((platform): PlatformTrend => {
    const own = releases.filter((release) => release.file.platform === platform);
    // Every platform lists every metric in the same order, so charts line up and a metric measured only
    // elsewhere can say it is not measured here. This platform's files come last, so their budgets win.
    const keys = collectKeys([...releases, ...own].map((release) => release.file));
    const metrics = [...keys].map(([key, info]): TrendMetric => {
      let previous: number[] | undefined;
      const points = versions.map((version) => {
        const values = own
          .find((release) => release.version === version)
          ?.file.metrics.find((metric) => keyOf(metric) === key)?.values;
        if (!values?.length) {
          previous = undefined;
          return null;
        }
        const point: TrendPoint = { version, ...summarize(values) };
        if (previous) point.change = compareSamples(previous, values);
        previous = values;
        return point;
      });
      return { ...info, points };
    });
    return { platform, metrics };
  });
  return { versions, trends };
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

// Commits with results on every given platform. With suites, each platform must have measured all of them,
// so a run can skip the commit and reuse its results.
export const measuredCommits = (results: CachedResult[], platforms: string[], suites: string[] = []) => {
  const measured = new Map<string, Set<string>>();
  for (const result of results) {
    const key = `${result.file.commit.sha}|${result.file.platform}`;
    const seen = measured.get(key) ?? new Set<string>();
    for (const suite of result.file.suites) seen.add(suite.id);
    measured.set(key, seen);
  }
  const shas = new Set(results.map((result) => result.file.commit.sha));
  return new Set(
    [...shas].filter((sha) =>
      platforms.every((platform) => {
        const seen = measured.get(`${sha}|${platform}`);
        return seen && suites.every((suite) => seen.has(suite));
      }),
    ),
  );
};

// One run's measurements per commit and platform, so agents can read a run without choosing commits.
export const buildRunResults = (results: CachedResult[], runId: string, platforms: string[]) => {
  const own = results.filter((result) => runIdOf(result) === runId);
  const measured = new Set(own.map((result) => result.file.platform));
  return {
    results: own.map(({ file }) => ({
      commit: file.commit,
      platform: file.platform,
      suites: file.suites.map((suite) => suite.id),
      metrics: file.metrics.map((metric) => ({
        ...metricKey(file, metric),
        ...summarize(metric.values),
        values: metric.values,
        ...(metric.budget === undefined ? {} : { overBudget: median(metric.values) > metric.budget }),
      })),
    })),
    // Platforms the run covered without results: failed, cancelled, still running, or not downloaded yet.
    missingPlatforms: platforms.filter((platform) => !measured.has(platform)),
  };
};

export interface ReleaseStatus {
  version: string;
  finished: string[];
  running: string[];
  missing: string[];
}

// The newest stable release, when some platforms have no results. Its release run is still going, failed,
// or never started; either way the page names it instead of drawing it as zero.
export const latestReleaseStatus = (
  releases: ReleaseRecord[],
  runs: RunRecord[],
  platforms: string[],
): ReleaseStatus | undefined => {
  const [latest] = [...releases].sort((a, b) => compareVersions(b.version, a.version));
  if (!latest) return undefined;
  const done = platforms.filter((platform) => latest.platforms.includes(platform));
  if (done.length === platforms.length) return undefined;
  const tag = `pstdio@${latest.version}`;
  const active = runs.filter((run) => !finished(run.status) && run.commits.some((commit) => commit.ref === tag));
  const running = platforms.filter(
    (platform) => !done.includes(platform) && active.some((run) => run.platforms.includes(platform)),
  );
  const missing = platforms.filter((platform) => !done.includes(platform) && !running.includes(platform));
  return { version: latest.version, finished: done, running, missing };
};
