import { buildComparison } from "../../benchmarks/analysis";
import type { BenchmarkUnit } from "../../benchmarks/result-file";
import type { CachedResult, RunRecord } from "../../benchmarks/store";

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

export type RunResults = "complete" | "partial" | "none";

export interface ProposedRun extends RunRecord {
  source: string;
  results: RunResults;
  commits: string[];
  note?: string;
}

const run = (entry: Omit<ProposedRun, "url" | "synced">): ProposedRun => ({
  ...entry,
  url: `https://github.com/pufflyai/prompt-studio/actions/runs/${entry.id}`,
  synced: entry.results !== "none",
});

export const proposedRuns: ProposedRun[] = [
  run({
    id: "1046",
    title: "Benchmarks 3d7f576,65d36f4 on linux-x64",
    status: "running",
    progress: 0.46,
    source: "Started here",
    results: "none",
    commits: ["3d7f5766b0", "65d36f4490"],
    note: "Storage finished · Runtime running",
    createdAt: "2026-11-01T10:12:00Z",
    updatedAt: "2026-11-01T10:16:00Z",
  }),
  run({
    id: "1045",
    title: "Benchmarks pstdio@0.46.0 on 4 platforms",
    status: "running",
    progress: 0.2,
    source: "Release pstdio@0.46.0",
    results: "none",
    commits: ["4b2c9e10aa"],
    note: "Linux x64 finished · macOS and Windows running",
    createdAt: "2026-11-01T09:58:00Z",
    updatedAt: "2026-11-01T10:15:00Z",
  }),
  run({
    id: "1044",
    title: "Benchmarks 3d7f576,65d36f4 on linux-x64",
    status: "succeeded",
    source: "Started here",
    results: "complete",
    commits: ["3d7f5766b0", "65d36f4490"],
    createdAt: "2026-11-01T09:00:00Z",
    updatedAt: "2026-11-01T09:06:00Z",
  }),
  run({
    id: "1041",
    title: "Benchmarks 65d36f4 on linux-x64",
    status: "succeeded",
    source: "Started by an agent",
    results: "complete",
    commits: ["65d36f4490"],
    createdAt: "2026-10-31T17:10:00Z",
    updatedAt: "2026-10-31T17:16:00Z",
  }),
  run({
    id: "1040",
    title: "Benchmarks 3d7f576,65d36f4 on linux-x64",
    status: "failed",
    failure: "linux-x64 · runtime: Run benchmarks exited with code 1",
    source: "Started on GitHub",
    results: "partial",
    commits: ["3d7f5766b0", "65d36f4490"],
    note: "Storage finished · Runtime failed",
    createdAt: "2026-10-31T16:53:00Z",
    updatedAt: "2026-10-31T17:02:00Z",
  }),
  run({
    id: "1039",
    title: "Benchmarks 3d7f576,65d36f4 on linux-x64",
    status: "cancelled",
    source: "Started here",
    results: "partial",
    commits: ["3d7f5766b0", "65d36f4490"],
    note: "Storage finished before the cancel · Runtime was stopped and has no measurements",
    createdAt: "2026-10-31T15:37:00Z",
    updatedAt: "2026-10-31T15:41:00Z",
  }),
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

// The base comes from run 1031 and the head from run 1041, measured on different runners at different times.
export const separateComparison = buildComparison(
  [result("1031", BASE, "base"), result("1041", HEAD, "head")],
  BASE,
  HEAD,
  "linux-x64",
);

// Run 1039 was cancelled after Storage finished, so Runtime has no measurements.
export const cancelledComparison = buildComparison(
  [result("1039", BASE, "base", "storage"), result("1039", HEAD, "head", "storage")],
  BASE,
  HEAD,
  "linux-x64",
);
