import { buildComparison } from "../benchmarks/analysis";
import type { BenchmarkMetricResult } from "../benchmarks/result-file";
import type { CachedResult, RunRecord } from "../benchmarks/store";
import type { RefOption } from "../runs/ref-input";

// Sample runs and one-sample results for stories. CI measures each benchmark once.
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
