import { defineCommand, type ExtensionContextBase, params } from "@pstdio/sdk/extensions";
import { buildComparison, buildRunResults, buildTrends, latestReleaseStatus, measuredCommits } from "./analysis";
import { listCommits } from "./commits";
import { finished, startRun } from "./github";
import { DEFAULT_PLATFORM, DEFAULT_SUITES, PLATFORMS, runsOn, SUITES } from "./platforms";
import {
  changed,
  patchRuns,
  type RunRecord,
  readReleases,
  readResults,
  readRuns,
  readSyncedAt,
  refreshRun,
  stopRun,
  syncAll,
  syncRuns,
} from "./store";

const FOLLOW_INTERVAL_MS = 30_000;
// GitHub can fail a status read now and then; a follower gives up only after this many failures in a row.
const FOLLOW_ATTEMPTS = 5;
const ALL_PLATFORMS: string[] = PLATFORMS.map((platform) => platform.id);

// Keeps a dispatched run's progress current and caches its results the moment it finishes.
const followRunCommand = defineCommand({
  id: "benchmarks.follow-run",
  title: "Follow a benchmark run",
  automation: true,
  params: { runId: params.text({ required: true }) },
  async run(ctx, { runId }) {
    let failures = 0;
    for (;;) {
      const status = await refreshRun(ctx, runId).then(
        (value) => {
          failures = 0;
          return value;
        },
        (error: unknown) => {
          if (++failures >= FOLLOW_ATTEMPTS) throw error;
          return undefined;
        },
      );
      if (status && finished(status)) break;
      await new Promise((resolve) => setTimeout(resolve, FOLLOW_INTERVAL_MS));
    }
    await syncRuns(ctx);
    await changed(ctx, runId);
    return { runId };
  },
});

type FollowContext = Pick<ExtensionContextBase, "automation" | "extensionFiles">;
let following: Promise<unknown> = Promise.resolve();

// One follower per run at a time. A follower that ended, by a restart or repeated GitHub errors, is replaced
// the next time the run is seen. Follows run in turn, so pages syncing together do not start two.
const follow = (ctx: FollowContext, run: RunRecord) => {
  const next = following.then(async () => {
    const current = run.followId ? await ctx.automation.get(run.followId) : undefined;
    if (current && (current.status === "queued" || current.status === "running")) return;
    const automation = await ctx.automation.enqueue({
      command: followRunCommand.ref,
      input: { params: { runId: run.id } },
      key: `${run.id}:${Date.now()}`,
    });
    await patchRuns(ctx, [{ id: run.id, followId: automation.id }]);
  });
  following = next.catch(() => undefined);
  return next;
};

const syncCommand = defineCommand({
  id: "benchmarks.sync",
  title: "Sync benchmark results",
  cli: true,
  async run(ctx) {
    try {
      await syncAll(ctx);
    } finally {
      // Runs started by a teammate, an agent, a release, or on GitHub keep updating, even when a sync fails.
      for (const run of (await readRuns(ctx)).filter((entry) => !finished(entry.status))) await follow(ctx, run);
    }
    return { runs: (await readRuns(ctx)).length, syncedAt: await readSyncedAt(ctx) };
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
    const strange = platforms.filter((platform) => !ALL_PLATFORMS.includes(platform));
    if (strange.length) throw new Error(`Unknown platforms: ${strange.join(", ")}. Use ${ALL_PLATFORMS.join(", ")}.`);
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
    // dispatched tells "nothing to run" apart from a run whose id GitHub has not shown yet.
    if (!fresh.length) return { dispatched: false, runId: undefined, reused, skipped };
    const runId = await startRun(ctx, { commits: fresh.map((commit) => commit.ref), suites, platforms });
    await syncRuns(ctx);
    const run = (await readRuns(ctx)).find((entry) => entry.id === runId);
    if (run) {
      // The listing knows only refs, so the SHAs resolved here identify the commits until results arrive.
      const commits = run.commits.map((commit) => ({
        ...commit,
        sha: commit.sha ?? fresh.find((entry) => entry.ref === commit.ref)?.sha,
      }));
      await patchRuns(ctx, [{ id: run.id, commits }]);
      await follow(ctx, run);
    }
    await changed(ctx, runId);
    return { dispatched: true, runId, reused, skipped };
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
