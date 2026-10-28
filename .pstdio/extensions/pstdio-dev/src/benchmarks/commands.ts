import { defineCommand, params } from "@pstdio/sdk/extensions";
import { buildComparison, buildTrends, measuredCommits } from "./analysis";
import { listCommits } from "./commits";
import { startRun } from "./github";
import { DEFAULT_PLATFORM } from "./platforms";
import { changed, finished, readResults, readRuns, refreshRun, stopRun, syncAll, syncRuns } from "./store";

const FOLLOW_INTERVAL_MS = 30_000;

const syncCommand = defineCommand({
  id: "benchmarks.sync",
  title: "Sync benchmark results",
  cli: true,
  async run(ctx) {
    await syncAll(ctx);
    return { runs: (await readRuns(ctx)).length };
  },
});

// Keeps a dispatched run's progress current and caches its results the moment it finishes.
const followRunCommand = defineCommand({
  id: "benchmarks.follow-run",
  title: "Follow a benchmark run",
  automation: true,
  params: { runId: params.text({ required: true }) },
  async run(ctx, { runId }) {
    while (!finished(await refreshRun(ctx, runId))) {
      await new Promise((resolve) => setTimeout(resolve, FOLLOW_INTERVAL_MS));
    }
    await syncRuns(ctx);
    await changed(ctx, runId);
    return { runId };
  },
});

const trendsCommand = defineCommand({
  id: "benchmarks.trends",
  title: "Read benchmark trends",
  params: { platform: params.text() },
  async run(ctx, { platform = DEFAULT_PLATFORM }) {
    return { platform, ...buildTrends(await readResults(ctx), platform) };
  },
});

const commitsCommand = defineCommand({
  id: "benchmarks.commits",
  title: "List commits to compare",
  params: { platform: params.text() },
  async run(ctx, { platform = DEFAULT_PLATFORM }) {
    const results = await readResults(ctx);
    const measured = measuredCommits(results, platform);
    return (await listCommits(ctx, results)).map((commit) => ({ ...commit, measured: measured.has(commit.sha) }));
  },
});

const compareCommand = defineCommand({
  id: "benchmarks.compare",
  title: "Compare two commits",
  params: {
    base: params.text({ required: true }),
    head: params.text({ required: true }),
    platform: params.text(),
  },
  async run(ctx, { base, head, platform = DEFAULT_PLATFORM }) {
    return buildComparison(await readResults(ctx), base, head, platform);
  },
});

const runsCommand = defineCommand({
  id: "benchmarks.runs",
  title: "List benchmark runs",
  run: (ctx) => readRuns(ctx),
});

const startRunCommand = defineCommand({
  id: "benchmarks.start-run",
  title: "Run benchmarks on GitHub Actions",
  cli: true,
  mutating: true,
  params: {
    commits: params.list({ label: "Commits, base first", required: true }),
    suites: params.list({ label: "Suites" }),
    platforms: params.list({ label: "Platforms" }),
    samples: params.number({ label: "Samples per commit" }),
  },
  async run(ctx, input) {
    const runId = await startRun(ctx, {
      commits: input.commits,
      suites: input.suites ?? [],
      platforms: input.platforms?.length ? input.platforms : [DEFAULT_PLATFORM],
      samples: input.samples ?? 10,
    });
    await syncRuns(ctx);
    if (runId)
      await ctx.automation.enqueue({ command: followRunCommand.ref, input: { params: { runId } }, key: runId });
    await changed(ctx, runId);
    return { runId };
  },
});

const cancelRunCommand = defineCommand({
  id: "benchmarks.cancel-run",
  title: "Cancel a benchmark run",
  mutating: true,
  params: { runId: params.text({ required: true }) },
  async run(ctx, { runId }) {
    await stopRun(ctx, runId);
    return { runId };
  },
});

// Keys match command ids, so webviews call them through the typed client.
export const benchmarkCommands = {
  "benchmarks.sync": syncCommand,
  "benchmarks.follow-run": followRunCommand,
  "benchmarks.trends": trendsCommand,
  "benchmarks.commits": commitsCommand,
  "benchmarks.compare": compareCommand,
  "benchmarks.runs": runsCommand,
  "benchmarks.start-run": startRunCommand,
  "benchmarks.cancel-run": cancelRunCommand,
};
export const syncCommandRef = syncCommand.ref;
