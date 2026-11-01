import { buildComparison, type TrendMetric } from "../../benchmarks/analysis";
import { PLATFORMS } from "../../benchmarks/platforms";
import type { BenchmarkUnit } from "../../benchmarks/result-file";
import type { CachedResult, RunRecord } from "../../benchmarks/store";
import { storyTrends } from "../../webview/story-fixtures";

// PS-1003 proposal data. CI measures each benchmark once, so every proposed result has one sample.
export interface SuiteOption {
  id: string;
  label: string;
  minutes: number;
  platforms?: string[];
  reason?: string;
}

// Every suite the benchmark package declares, with the platforms a suite is limited to.
export const SUITES: SuiteOption[] = [
  { id: "desktop", label: "Desktop app", minutes: 3 },
  { id: "workbench", label: "Workbench interactions", minutes: 4 },
  { id: "canvas", label: "Canvas cold startup", minutes: 2 },
  { id: "chat", label: "Chat rendering", minutes: 3 },
  { id: "subnav", label: "Side navigation", minutes: 2 },
  { id: "planner", label: "Planner board", minutes: 1 },
  { id: "storage", label: "Storage", minutes: 1 },
  { id: "runtime", label: "Runtime", minutes: 1 },
  { id: "relay", label: "Relay storage", minutes: 3, platforms: ["linux-x64"], reason: "Needs Linux x64 and Docker" },
];

export interface RunCommit {
  sha: string;
  ref?: string;
}

export interface ProposedRun extends RunRecord {
  commits: RunCommit[];
  platforms: string[];
  // Shown in the status tooltip, such as which suites finished before a cancel.
  detail?: string;
}

const run = (entry: Omit<ProposedRun, "url" | "synced" | "title">): ProposedRun => ({
  ...entry,
  title: "",
  url: `https://github.com/pufflyai/prompt-studio/actions/runs/${entry.id}`,
  synced: entry.status !== "running",
});

export const proposedRuns: ProposedRun[] = [
  run({
    id: "1046",
    status: "running",
    progress: 0.46,
    commits: [{ sha: "65d36f4490", ref: "main" }],
    platforms: ["linux-x64"],
    detail: "Running · Storage finished",
    createdAt: "2026-11-01T10:12:00Z",
    updatedAt: "2026-11-01T10:16:00Z",
  }),
  run({
    id: "1045",
    status: "running",
    progress: 0.2,
    commits: [{ sha: "4b2c9e10aa", ref: "pstdio@0.46.0" }],
    platforms: ["linux-x64", "darwin-arm64", "darwin-x64", "win32-x64"],
    detail: "Running · Linux x64 finished",
    createdAt: "2026-11-01T09:58:00Z",
    updatedAt: "2026-11-01T10:15:00Z",
  }),
  run({
    id: "1044",
    status: "succeeded",
    commits: [{ sha: "3d7f5766b0" }, { sha: "65d36f4490" }],
    platforms: ["linux-x64"],
    createdAt: "2026-11-01T09:00:00Z",
    updatedAt: "2026-11-01T09:06:00Z",
  }),
  run({
    id: "1041",
    status: "succeeded",
    commits: [{ sha: "8e41b07d2c", ref: "pstdio@0.44.0" }],
    platforms: ["linux-x64", "win32-x64"],
    createdAt: "2026-10-31T17:10:00Z",
    updatedAt: "2026-10-31T17:16:00Z",
  }),
  run({
    id: "1040",
    status: "failed",
    failure: "linux-x64 · runtime: Run benchmarks exited with code 1",
    commits: [{ sha: "1520ba3e4f" }],
    platforms: ["linux-x64"],
    detail: "Failed · Storage finished, Runtime failed",
    createdAt: "2026-10-31T16:53:00Z",
    updatedAt: "2026-10-31T17:02:00Z",
  }),
  run({
    id: "1039",
    status: "cancelled",
    commits: [{ sha: "87abbbf2d1" }],
    platforms: ["linux-x64"],
    detail: "Cancelled · Storage finished, Runtime stopped",
    createdAt: "2026-10-31T15:37:00Z",
    updatedAt: "2026-10-31T15:41:00Z",
  }),
];

export interface RefOption {
  ref: string;
  sha: string;
  // Has results for the chosen suites and platforms, so a new run reuses them instead of measuring again.
  measured: boolean;
}

// Every release tag, newest first. The new-run input lists these when it opens.
export const TAGS: RefOption[] = [
  { ref: "pstdio@0.46.0", sha: "4b2c9e10aa", measured: false },
  { ref: "pstdio@0.45.0", sha: "3ad9c7c1f0", measured: true },
  { ref: "pstdio@0.44.0", sha: "8e41b07d2c", measured: true },
  { ref: "pstdio@0.43.1", sha: "c07a51e98b", measured: true },
  { ref: "pstdio@0.43.0", sha: "5f2d6b4a10", measured: false },
  { ref: "pstdio@0.42.0", sha: "a9e3c27f55", measured: false },
  { ref: "pstdio@0.41.0", sha: "0d6e8f1b32", measured: false },
  { ref: "pstdio@0.40.0", sha: "e4b19a6c07", measured: false },
];

// Commits the run form recognizes besides tags.
export const KNOWN_REFS: RefOption[] = [
  ...TAGS,
  { ref: "main", sha: "65d36f4490", measured: true },
  { ref: "3d7f5766b0", sha: "3d7f5766b0", measured: true },
];

interface MetricDefinition {
  suite: string;
  metric: string;
  label: string;
  unit: BenchmarkUnit;
  budget?: number;
  base: number;
  head: number;
}

const metrics: MetricDefinition[] = [
  {
    suite: "storage",
    metric: "badge-query",
    label: "Session badges for 28 workspaces",
    unit: "ms",
    budget: 100,
    base: 9.4,
    head: 9.1,
  },
  {
    suite: "storage",
    metric: "save-after-20000",
    label: "Record save after 20,000 edits",
    unit: "ms",
    base: 0.61,
    head: 0.66,
  },
  {
    suite: "runtime",
    metric: "session-resources",
    label: "Session resources for 40 sessions",
    unit: "ms",
    budget: 50,
    base: 38,
    head: 54,
  },
  {
    suite: "runtime",
    metric: "open-resource-lookup",
    label: "Open-resource lookups, total",
    unit: "ms",
    budget: 400,
    base: 121,
    head: 118,
  },
  {
    suite: "runtime",
    metric: "cleanup/memory",
    label: "Cleanup, runtime memory",
    unit: "bytes",
    base: 182e6,
    head: 191e6,
  },
];

const suites = [
  { id: "storage", label: "Storage", source: "packages/pstdio-db/src/services/**/*.bench.ts" },
  { id: "runtime", label: "Runtime", source: "packages/pstdio-api/src/**/*.bench.ts" },
];

const result = (runId: string, sha: string, side: "base" | "head", only?: string): CachedResult => ({
  source: { kind: "run", runId },
  file: {
    format: 1,
    commit: { sha },
    platform: "linux-x64",
    runner: "ubuntu-24.04",
    startedAt: "2026-11-01T09:00:00.000Z",
    finishedAt: "2026-11-01T09:06:00.000Z",
    suites,
    metrics: metrics
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

export const BASE = "3d7f5766b0";
export const HEAD = "65d36f4490";

// Run 1044 measured both commits on one runner.
export const pairedComparison = buildComparison(
  [result("1044", BASE, "base"), result("1044", HEAD, "head")],
  BASE,
  HEAD,
  "linux-x64",
);

// Run 1041 measured only the head commit.
export const headOnlyComparison = buildComparison([result("1041", HEAD, "head")], "", HEAD, "linux-x64");

// Any two commits compare, even from different runs. Run 1046 has only finished Storage so far, so Runtime
// metrics show as not measured on the head.
export const partialComparison = buildComparison(
  [result("1044", BASE, "base"), result("1046", HEAD, "head", "storage")],
  BASE,
  HEAD,
  "linux-x64",
);

// Each platform is slower or faster by a steady factor; Windows releases before 0.49.0 have no results.
const PLATFORM_FACTOR: Record<string, number> = {
  "linux-x64": 1,
  "darwin-arm64": 0.72,
  "darwin-x64": 1.35,
  "win32-x64": 1.6,
};

export interface PlatformTrend {
  platform: string;
  metrics: TrendMetric[];
}

export const platformTrends: PlatformTrend[] = PLATFORMS.map(({ id }) => ({
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
