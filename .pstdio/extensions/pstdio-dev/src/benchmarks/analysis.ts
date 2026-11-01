import { finished } from "./github";
import { platformLabel, runsOn, SUITES } from "./platforms";
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

const runIdOf = (result: CachedResult) => (result.source.kind === "run" ? result.source.runId : undefined);

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

// A release's history is every result for its commit: its release run, or any later run of its tag. GitHub
// releases are immutable once published, so results stay with the runs instead of the release. Each metric
// comes from the newest result that measured it.
export const releaseResults = (results: CachedResult[], releases: ReleaseRecord[]) => {
  const versionOf = new Map(releases.flatMap((release) => (release.sha ? [[release.sha, release.version]] : [])));
  const groups = new Map<string, { version: string; results: CachedResult[] }>();
  for (const result of results) {
    const version = result.source.kind === "release" ? result.source.version : versionOf.get(result.file.commit.sha);
    if (!version) continue;
    const key = `${version}|${result.file.platform}`;
    const group = groups.get(key) ?? { version, results: [] };
    group.results.push(result);
    groups.set(key, group);
  }
  return [...groups.values()].map(({ version, results: group }): CachedResult => {
    const newestFirst = [...group].sort((a, b) => Number(runIdOf(b) ?? 0) - Number(runIdOf(a) ?? 0));
    const files = newestFirst.map((result) => result.file);
    const suites = files.flatMap((file) => file.suites);
    const metrics = files.flatMap((file) => file.metrics.filter((metric) => metric.values.length));
    return {
      source: { kind: "release", version },
      file: {
        ...files[0],
        suites: suites.filter((suite, index) => suites.findIndex((entry) => entry.id === suite.id) === index),
        metrics: metrics.filter(
          (metric, index) => metrics.findIndex((entry) => keyOf(entry) === keyOf(metric)) === index,
        ),
      },
    };
  });
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

const valuesOf = (result: CachedResult | undefined, key: string) =>
  result?.file.metrics.find((metric) => keyOf(metric) === key)?.values;

// Each metric comes from the newest result that measured it, so a newer run of a few suites does not hide
// older results of the others. A run that measured the metric on both commits wins, being the fairest pair.
export const buildComparison = (results: CachedResult[], base: string, head: string, platform: string) => {
  const newestFirst = results
    .filter((result) => result.file.platform === platform)
    .sort((a, b) => Number(runIdOf(b) ?? 0) - Number(runIdOf(a) ?? 0));
  const baseResults = newestFirst.filter((result) => result.file.commit.sha === base);
  const headResults = newestFirst.filter((result) => result.file.commit.sha === head);
  const present = [...baseResults, ...headResults].map((result) => result.file);
  const rows = [...collectKeys(present)].map(([key, info]): CompareRow => {
    const pairedHead = headResults.find(
      (result) =>
        runIdOf(result) &&
        valuesOf(result, key)?.length &&
        baseResults.some((entry) => runIdOf(entry) === runIdOf(result) && valuesOf(entry, key)?.length),
    );
    const pick = (side: CachedResult[]) =>
      pairedHead
        ? valuesOf(
            side.find((result) => runIdOf(result) === runIdOf(pairedHead)),
            key,
          )
        : valuesOf(
            side.find((result) => valuesOf(result, key)?.length),
            key,
          );
    const baseValues = pick(baseResults);
    const headValues = pick(headResults);
    return {
      ...info,
      base: baseValues?.length ? { ...summarize(baseValues), values: baseValues } : null,
      head: headValues?.length ? { ...summarize(headValues), values: headValues } : null,
      change: baseValues?.length && headValues?.length ? compareSamples(baseValues, headValues) : null,
    };
  });
  return { hasBase: baseResults.length > 0, hasHead: headResults.length > 0, rows };
};

// Commits with results on every given platform. With suites, each platform must have measured every suite that
// runs there, so a run can skip the commit and reuse its results.
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
        const expected = SUITES.filter((suite) => suites.includes(suite.id) && runsOn(suite, platform));
        return seen && expected.every((suite) => seen.has(suite.id));
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
  // Suite jobs that failed in a finished run of the release, as "<platform> · <suite>".
  failed: string[];
}

// The newest stable release, when some platforms have no results. Its release run is still going, failed,
// or never started; either way the page names it instead of drawing it as zero.
export const latestReleaseStatus = (
  releases: ReleaseRecord[],
  runs: RunRecord[],
  platforms: string[],
  history: CachedResult[],
): ReleaseStatus | undefined => {
  const [latest] = [...releases].sort((a, b) => compareVersions(b.version, a.version));
  if (!latest) return undefined;
  const measured = history.filter(
    (result) => result.source.kind === "release" && result.source.version === latest.version,
  );
  const done = platforms.filter((platform) => measured.some((result) => result.file.platform === platform));

  const tag = `pstdio@${latest.version}`;
  const ofRelease = runs.filter((run) =>
    run.commits.some((commit) => commit.ref === tag || (latest.sha && commit.sha === latest.sha)),
  );
  const active = ofRelease.filter((run) => !finished(run.status));
  // A suite that failed in one run and passed in a later one has results, so only the newest outcome counts.
  const outcomes = new Map<string, string>();
  for (const run of ofRelease.filter((entry) => finished(entry.status)).reverse()) {
    for (const line of run.detail?.split("\n") ?? []) {
      const [, name, outcome] = line.match(/^(.*) (finished|failed|stopped|queued|running)$/) ?? [];
      if (name) outcomes.set(run.platforms.length > 1 ? name : `${platformLabel(run.platforms[0])} · ${name}`, outcome);
    }
  }
  const failed = [...outcomes].flatMap(([name, outcome]) => (outcome === "failed" ? [name] : []));
  const running = platforms.filter(
    (platform) => !done.includes(platform) && active.some((run) => run.platforms.includes(platform)),
  );
  const missing = platforms.filter((platform) => !done.includes(platform) && !running.includes(platform));
  if (!running.length && !missing.length && !failed.length) return undefined;
  return { version: latest.version, finished: done, running, missing, failed };
};
