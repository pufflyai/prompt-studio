import { buildComparison, buildTrends, type PlatformTrend } from "../benchmarks/analysis";
import { PLATFORMS } from "../benchmarks/platforms";
import type { BenchmarkMetricResult, BenchmarkResultFile } from "../benchmarks/result-file";
import type { CachedResult, RunRecord } from "../benchmarks/store";
import type { CommitOptionView } from "../compare/commit-picker";
import type { RefOption } from "../runs/ref-input";

// Sample data for stories. Medians follow plausible release history; noise is seeded so stories are stable.
const versions = ["0.46.0", "0.47.0", "0.48.0", "0.49.0", "0.49.1", "0.50.0", "0.50.1", "0.51.0"];

interface SeriesDefinition {
  suite: string;
  metric: string;
  label: string;
  unit: BenchmarkMetricResult["unit"];
  budget?: number;
  noise: number;
  medians: number[];
}

const series: SeriesDefinition[] = [
  {
    suite: "desktop",
    metric: "cold-start/cold-start",
    label: "Cold start",
    unit: "ms",
    budget: 8000,
    noise: 0.06,
    medians: [6900, 6750, 7100, 6600, 6450, 5300, 5250, 5400],
  },
  {
    suite: "desktop",
    metric: "warm-attach/warm-attach",
    label: "Warm attach",
    unit: "ms",
    budget: 3000,
    noise: 0.08,
    medians: [2100, 2050, 2240, 2180, 2150, 1720, 1690, 1700],
  },
  {
    suite: "desktop",
    metric: "sidecar-crash-recovery/recovery-ui",
    label: "Sidecar crash recovery, recovery ui",
    unit: "ms",
    budget: 500,
    noise: 0.1,
    medians: [190, 200, 185, 180, 182, 176, 178, 262],
  },
  {
    suite: "desktop",
    metric: "idle-workbench/app-memory",
    label: "Idle workbench, memory of all app processes",
    unit: "bytes",
    noise: 0.03,
    medians: [612e6, 618e6, 640e6, 655e6, 650e6, 590e6, 588e6, 702e6],
  },
  {
    suite: "workbench",
    metric: "project-switch/a-to-b",
    label: "Project switch, a to b",
    unit: "ms",
    budget: 575,
    noise: 0.05,
    medians: [420, 410, 395, 400, 380, 310, 300, 305],
  },
  {
    suite: "workbench",
    metric: "panel-tabs/open-panel",
    label: "Panel tabs, open panel",
    unit: "ms",
    budget: 150,
    noise: 0.09,
    medians: [140, 138, 150, 145, 120, 118, 115, 117],
  },
  {
    suite: "workbench",
    metric: "project-switch/js-heap",
    label: "Project switch, page heap",
    unit: "bytes",
    noise: 0.04,
    medians: [48e6, 49e6, 51e6, 50e6, 47e6, 44e6, 44e6, 45e6],
  },
  {
    suite: "storage",
    metric: "save-after-20000",
    label: "Record save after 20,000 edits",
    unit: "ms",
    noise: 0.12,
    medians: [4.8, 5.1, 5.6, 6.2, 6.8, 0.6, 0.62, 0.6],
  },
  {
    suite: "storage",
    metric: "badge-query",
    label: "Session badges for 28 workspaces",
    unit: "ms",
    noise: 0.1,
    medians: [48, 47, 46, 45, 44, 9, 8.8, 8.9],
  },
];

const suites = [
  { id: "desktop", label: "Desktop app", source: "clients/desktop/src/e2e/packaged-*.bench.ts" },
  { id: "workbench", label: "Workbench interactions", source: "packages/e2e/src/perf/*.perf.ts" },
  { id: "storage", label: "Storage", source: "packages/pstdio-db/src/services/**/*.bench.ts" },
];

const seeded = (seed: number) => {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647 - 0.5;
  };
};

const samples = (median: number, noise: number, seed: number) => {
  const random = seeded(seed);
  return Array.from({ length: 10 }, () => median * (1 + noise * 2 * random()));
};

const seedOf = (text: string) =>
  [...text].reduce((sum, character) => (sum * 31 + character.charCodeAt(0)) % 100_000, 7);

const resultFile = (sha: string, index: number, effect = (_: SeriesDefinition) => 1): BenchmarkResultFile => ({
  format: 1,
  commit: { sha },
  platform: "linux-x64",
  runner: "ubuntu-24.04",
  startedAt: "2026-10-22T09:00:00.000Z",
  finishedAt: "2026-10-22T09:40:00.000Z",
  suites,
  metrics: series.map((entry, position) => ({
    suite: entry.suite,
    metric: entry.metric,
    label: entry.label,
    unit: entry.unit,
    ...(entry.budget === undefined ? {} : { budget: entry.budget }),
    values: samples(entry.medians[index] * effect(entry), entry.noise, 1000 + index * 31 + position * 7 + seedOf(sha)),
  })),
});

const releaseResults: CachedResult[] = versions.map((version, index) => ({
  source: { kind: "release", version },
  file: resultFile(`release-${version}`, index),
}));

const linuxTrends = buildTrends(releaseResults, ["linux-x64"]);
export const storyTrends = { versions: linuxTrends.versions, metrics: linuxTrends.trends[0].metrics };

const headEffect = (entry: SeriesDefinition) => {
  if (entry.metric === "panel-tabs/open-panel") return 1.14;
  if (entry.metric === "idle-workbench/app-memory") return 1.09;
  if (entry.metric === "cold-start/cold-start") return 0.9;
  return 1;
};

const comparisonResults: CachedResult[] = [
  { source: { kind: "run", runId: "1042" }, file: resultFile("3d7f5766b0", 7) },
  { source: { kind: "run", runId: "1042" }, file: resultFile("65d36f4490", 7, headEffect) },
];

export const storyComparison = buildComparison(comparisonResults, "3d7f5766b0", "65d36f4490", "linux-x64");

export const storyCommits: CommitOptionView[] = [
  {
    sha: "65d36f4490",
    ref: "main",
    message: "feat(PS-871): enable Cloud early access per account (#1319)",
    measured: true,
  },
  {
    sha: "3d7f5766b0",
    ref: "main~1",
    message: "fix(PS-788): save Auto Build settings and supervisor resets together (#1331)",
    measured: true,
  },
  {
    sha: "f5c5c4b6e0",
    ref: "main~2",
    message: "fix(PS-892): keep error alerts usable and prevent offline lookup crashes (#1327)",
    measured: false,
  },
  { sha: "3ad9c7c1f0", ref: "pstdio@0.45.0", message: "Version Packages (#1223)", measured: true },
];

const run = (entry: Omit<RunRecord, "url" | "synced" | "title">): RunRecord => ({
  ...entry,
  title: `Benchmarks ${entry.commits.map((commit) => commit.ref).join(",")} on ${entry.platforms.join(",")}`,
  url: `https://github.com/pufflyai/prompt-studio/actions/runs/${entry.id}`,
  synced: entry.status !== "running",
});

export const storyRuns: RunRecord[] = [
  run({
    id: "1046",
    status: "running",
    progress: 0.46,
    commits: [{ ref: "main", sha: "65d36f4490" }],
    platforms: ["linux-x64"],
    detail: "Storage finished\nRuntime running",
    createdAt: "2026-11-01T10:12:00Z",
    updatedAt: "2026-11-01T10:16:00Z",
  }),
  run({
    id: "1045",
    status: "running",
    progress: 0.2,
    commits: [{ ref: "pstdio@0.46.0", sha: "4b2c9e10aa" }],
    platforms: ["linux-x64", "darwin-arm64", "darwin-x64", "win32-x64"],
    detail: "Linux x64 · Storage finished\nmacOS arm64 · Storage running",
    createdAt: "2026-11-01T09:58:00Z",
    updatedAt: "2026-11-01T10:15:00Z",
  }),
  run({
    id: "1044",
    status: "succeeded",
    commits: [
      { ref: "3d7f5766b0", sha: "3d7f5766b0" },
      { ref: "main", sha: "65d36f4490" },
    ],
    platforms: ["linux-x64"],
    createdAt: "2026-11-01T09:00:00Z",
    updatedAt: "2026-11-01T09:06:00Z",
  }),
  run({
    id: "1041",
    status: "succeeded",
    commits: [{ ref: "pstdio@0.44.0", sha: "8e41b07d2c" }],
    platforms: ["linux-x64", "win32-x64"],
    createdAt: "2026-10-31T17:10:00Z",
    updatedAt: "2026-10-31T17:16:00Z",
  }),
  run({
    id: "1040",
    status: "failed",
    failure: "linux-x64 · runtime: Run benchmarks",
    commits: [{ ref: "1520ba3e4f", sha: "1520ba3e4f" }],
    platforms: ["linux-x64"],
    detail: "Storage finished\nRuntime failed",
    createdAt: "2026-10-31T16:53:00Z",
    updatedAt: "2026-10-31T17:02:00Z",
  }),
  run({
    id: "1039",
    status: "cancelled",
    commits: [{ ref: "87abbbf2d1", sha: "87abbbf2d1" }],
    platforms: ["linux-x64"],
    detail: "Storage finished\nRuntime stopped",
    createdAt: "2026-10-31T15:37:00Z",
    updatedAt: "2026-10-31T15:41:00Z",
  }),
];

// Release tags and main for the run form, newest first. Measured ones already have results.
export const storyRefs: RefOption[] = [
  { ref: "pstdio@0.46.0", sha: "4b2c9e10aa", measured: false },
  { ref: "pstdio@0.45.0", sha: "3ad9c7c1f0", measured: true },
  { ref: "pstdio@0.44.0", sha: "8e41b07d2c", measured: true },
  { ref: "pstdio@0.43.1", sha: "c07a51e98b", measured: true },
  { ref: "pstdio@0.43.0", sha: "5f2d6b4a10", measured: false },
  { ref: "pstdio@0.42.0", sha: "a9e3c27f55", measured: false },
  { ref: "main", sha: "65d36f4490", measured: true },
];

// CI measures each benchmark once, so new comparisons have one sample per commit.
interface OnceDefinition {
  suite: string;
  metric: string;
  label: string;
  unit: BenchmarkMetricResult["unit"];
  budget?: number;
  base: number;
  head: number;
}

const onceMetrics: OnceDefinition[] = [
  { suite: "storage", metric: "badge-query", label: "Session badges for 28 workspaces", unit: "ms", budget: 100, base: 9.4, head: 9.1 },
  { suite: "storage", metric: "save-after-20000", label: "Record save after 20,000 edits", unit: "ms", base: 0.61, head: 0.66 },
  { suite: "runtime", metric: "session-resources", label: "Session resources for 40 sessions", unit: "ms", budget: 50, base: 38, head: 54 },
  { suite: "runtime", metric: "open-resource-lookup", label: "Open-resource lookups, total", unit: "ms", budget: 400, base: 121, head: 118 },
  { suite: "runtime", metric: "cleanup/memory", label: "Cleanup, runtime memory", unit: "bytes", base: 182e6, head: 191e6 },
];

const onceSuites = [
  { id: "storage", label: "Storage", source: "packages/pstdio-db/src/services/**/*.bench.ts" },
  { id: "runtime", label: "Runtime", source: "packages/pstdio-api/src/**/*.bench.ts" },
];

const once = (runId: string, sha: string, side: "base" | "head", only?: string): CachedResult => ({
  source: { kind: "run", runId },
  file: {
    format: 1,
    commit: { sha },
    platform: "linux-x64",
    runner: "ubuntu-24.04",
    startedAt: "2026-11-01T09:00:00.000Z",
    finishedAt: "2026-11-01T09:06:00.000Z",
    suites: onceSuites.filter((suite) => !only || suite.id === only),
    metrics: onceMetrics
      .filter((entry) => !only || entry.suite === only)
      .map((entry) => ({
        suite: entry.suite,
        metric: entry.metric,
        label: entry.label,
        unit: entry.unit,
        ...(entry.budget === undefined ? {} : { budget: entry.budget }),
        values: [entry[side]],
      })),
  },
});

// Run 1044 measured both commits once.
export const storyOnceComparison = buildComparison(
  [once("1044", "3d7f5766b0", "base"), once("1044", "65d36f4490", "head")],
  "3d7f5766b0",
  "65d36f4490",
  "linux-x64",
);

// The head commit alone, with no base chosen.
export const storyHeadOnly = buildComparison([once("1041", "65d36f4490", "head")], "", "65d36f4490", "linux-x64");

// Commits from different runs compare like any other. Run 1046 has finished only Storage so far, so Runtime
// shows as not measured on the head.
export const storyPartialComparison = buildComparison(
  [once("1044", "3d7f5766b0", "base"), once("1046", "65d36f4490", "head", "storage")],
  "3d7f5766b0",
  "65d36f4490",
  "linux-x64",
);

// Each platform is slower or faster by a steady factor; Windows has no results for the first three releases.
const PLATFORM_FACTOR: Record<string, number> = {
  "linux-x64": 1,
  "darwin-arm64": 0.72,
  "darwin-x64": 1.35,
  "win32-x64": 1.6,
};

export const storyPlatformTrends: PlatformTrend[] = PLATFORMS.map(({ id }) => ({
  platform: id,
  metrics: storyTrends.metrics.map((metric) => ({
    ...metric,
    points: metric.points.map((point, index) => {
      if (!point || (id === "win32-x64" && index < 3)) return null;
      const factor = PLATFORM_FACTOR[id];
      return { ...point, median: point.median * factor, low: point.low * factor, high: point.high * factor };
    }),
  })),
}));
