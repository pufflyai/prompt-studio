import { defineCommand, type ExtensionContextBase, params } from "@pstdio/sdk/extensions";
import { buildComparison, buildRunResults, buildTrends, latestReleaseStatus, measuredCommits } from "./analysis";
import { listCommits } from "./commits";
import { finished, startRun } from "./github";
import { DEFAULT_PLATFORM, DEFAULT_SUITES, PLATFORMS, runsOn, SUITES } from "./platforms";
import {
  changed,
  readReleases,
  readResults,
  readRuns,
  readSyncedAt,
  refreshRun,
  stopRun,
  syncAll,
  syncRuns,
  writeRuns,
} from "./store";

const FOLLOW_INTERVAL_MS = 30_000;
const ALL_PLATFORMS = PLATFORMS.map((platform) => platform.id);

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

// The run id is the idempotency key, so each run is followed once however often it is seen.
const follow = (ctx: Pick<ExtensionContextBase, "automation">, runId: string) =>
  ctx.automation.enqueue({ command: followRunCommand.ref, input: { params: { runId } }, key: runId });

const syncCommand = defineCommand({
  id: "benchmarks.sync",
  title: "Sync benchmark results",
  cli: true,
  async run(ctx) {
    await syncAll(ctx);
    // Runs started by a teammate, an agent, a release, or on GitHub keep updating too.
    const runs = await readRuns(ctx);
    for (const run of runs.filter((entry) => !finished(entry.status))) await follow(ctx, run.id);
    return { runs: runs.length, syncedAt: await readSyncedAt(ctx) };
  },
});

const syncStatusCommand = defineCommand({
  id: "benchmarks.sync-status",
  title: "Read when benchmark results last synced",
  async run(ctx) {
    return { syncedAt: await readSyncedAt(ctx) };
  },
});

const trendsCommand = defineCommand({
  id: "benchmarks.trends",
  title: "Read benchmark trends",
  params: { platforms: params.list({ label: "Platforms" }) },
  async run(ctx, input) {
    const platforms = input.platforms?.length ? input.platforms : ALL_PLATFORMS;
    return {
      ...buildTrends(await readResults(ctx), platforms),
      // Names the newest release while some of its platforms have no results, so it never reads as zero.
      pendingRelease: latestReleaseStatus(await readReleases(ctx), await readRuns(ctx), ALL_PLATFORMS),
    };
  },
});

const commitsCommand = defineCommand({
  id: "benchmarks.commits",
  title: "List commits to compare or measure",
  params: {
    platforms: params.list({ label: "Platforms" }),
    suites: params.list({ label: "Suites a commit must have results for" }),
  },
  async run(ctx, input) {
    const results = await readResults(ctx);
    const platforms = input.platforms?.length ? input.platforms : [DEFAULT_PLATFORM];
    const measured = measuredCommits(results, platforms, input.suites);
    return (await listCommits(ctx, results)).map((commit) => ({ ...commit, measured: measured.has(commit.sha) }));
  },
});

const compareCommand = defineCommand({
  id: "benchmarks.compare",
  title: "Compare two commits",
  params: {
    base: params.text({ label: "Base commit; leave empty to read the head's own results" }),
    head: params.text({ required: true }),
    platform: params.text(),
  },
  async run(ctx, { base = "", head, platform = DEFAULT_PLATFORM }) {
    return buildComparison(await readResults(ctx), base, head, platform);
  },
});

const runsCommand = defineCommand({
  id: "benchmarks.runs",
  title: "List benchmark runs",
  run: (ctx) => readRuns(ctx),
});

const runResultsCommand = defineCommand({
  id: "benchmarks.run-results",
  title: "Read one benchmark run's results",
  params: { runId: params.text({ required: true }) },
  async run(ctx, { runId }) {
    const run = (await readRuns(ctx)).find((entry) => entry.id === runId);
    if (!run) throw new Error(`Benchmark run ${runId} is not known. Sync benchmark results first.`);
    return { run, ...buildRunResults(await readResults(ctx), runId, run.platforms) };
  },
});

// Resolves through origin first, like the commit list, so a stale local branch is not mistaken for measured.
const resolveRef = async (ctx: Pick<ExtensionContextBase, "process">, ref: string) => {
  for (const candidate of [`origin/${ref}`, ref]) {
    const result = await ctx.process.run({
      command: ["git", "rev-parse", "--verify", "--quiet", `${candidate}^{commit}`],
    });
    if (result.exitCode === 0 && result.stdout.trim()) return result.stdout.trim();
  }
  return undefined;
};

const startRunCommand = defineCommand({
  id: "benchmarks.start-run",
  title: "Run benchmarks on GitHub Actions",
  cli: true,
  mutating: true,
  params: {
    commits: params.list({ label: "Commits, branches, or tags", required: true }),
    suites: params.list({ label: "Suites" }),
    platforms: params.list({ label: "Platforms" }),
  },
  async run(ctx, input) {
    const platforms = input.platforms?.length ? input.platforms : [DEFAULT_PLATFORM];
    const requested = input.suites?.length ? input.suites : DEFAULT_SUITES;
    const unknown = requested.filter((id) => !SUITES.some((suite) => suite.id === id));
    if (unknown.length) throw new Error(`Unknown suites: ${unknown.join(", ")}.`);
    const chosen = SUITES.filter((suite) => requested.includes(suite.id));
    // CI starts no job for a suite on a platform it does not support, so the result names those pairs.
    const skipped = chosen.flatMap((suite) =>
      platforms
        .filter((platform) => !runsOn(suite, platform))
        .map((platform) => ({ suite: suite.id, platform, reason: suite.reason })),
    );
    const suites = chosen
      .filter((suite) => platforms.some((platform) => runsOn(suite, platform)))
      .map((suite) => suite.id);
    if (!suites.length) throw new Error("None of the chosen suites runs on the chosen platforms.");
    // Commits that already have results for these suites and platforms are not measured again.
    const measured = measuredCommits(await readResults(ctx), platforms, suites);
    const commits = await Promise.all(input.commits.map(async (ref) => ({ ref, sha: await resolveRef(ctx, ref) })));
    const reused = commits.filter((commit) => commit.sha && measured.has(commit.sha));
    const fresh = commits.filter((commit) => !reused.includes(commit));
    if (!fresh.length) return { runId: undefined, reused, skipped };
    const runId = await startRun(ctx, { commits: fresh.map((commit) => commit.ref), suites, platforms });
    await syncRuns(ctx);
    if (runId) {
      // The listing knows only refs, so the SHAs resolved here identify the commits until results arrive.
      const runs = await readRuns(ctx);
      const run = runs.find((entry) => entry.id === runId);
      if (run) {
        run.commits = run.commits.map((commit) => ({
          ...commit,
          sha: commit.sha ?? fresh.find((entry) => entry.ref === commit.ref)?.sha,
        }));
        await writeRuns(ctx, runs);
      }
      await follow(ctx, runId);
    }
    await changed(ctx, runId);
    return { runId, reused, skipped };
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
  "benchmarks.sync-status": syncStatusCommand,
  "benchmarks.follow-run": followRunCommand,
  "benchmarks.trends": trendsCommand,
  "benchmarks.commits": commitsCommand,
  "benchmarks.compare": compareCommand,
  "benchmarks.runs": runsCommand,
  "benchmarks.run-results": runResultsCommand,
  "benchmarks.start-run": startRunCommand,
  "benchmarks.cancel-run": cancelRunCommand,
};
export const syncCommandRef = syncCommand.ref;
