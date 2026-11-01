import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionContextBase } from "@pstdio/sdk/extensions";
import { benchmarksChanged } from "./events";
import {
  cancelRun,
  downloadReleaseAsset,
  downloadRunArtifact,
  finished,
  listReleases,
  listRunArtifacts,
  listRuns,
  parseRunTitle,
  runProgress,
  type WorkflowRun,
} from "./github";
import { type BenchmarkResultFile, parseResultFile } from "./result-file";

export type StoreContext = Pick<ExtensionContextBase, "process" | "extensionFiles" | "events">;

export interface RunRecord extends WorkflowRun {
  progress?: number;
  // The first failed job and step, and each suite's outcome, from the run's jobs.
  failure?: string;
  detail?: string;
  // Why the finished run's results could not be downloaded yet. The next sync retries.
  syncError?: string;
  // The automation following the run, so a run gets one follower at a time.
  followId?: string;
  synced: boolean;
}

export interface ReleaseRecord {
  version: string;
  publishedAt: string;
  // Platforms whose benchmark asset the release has.
  platforms: string[];
}

const RUNS_FILE = "benchmarks/runs.json";
const RELEASES_FILE = "benchmarks/releases.json";
const SYNC_FILE = "benchmarks/sync.json";
const RELEASE_ASSET = /^benchmarks-(.+)\.json$/;
const RUN_ARTIFACT = /^benchmark-results-/;
const STABLE_TAG = /^pstdio@(\d+\.\d+\.\d+)$/;

// Every result the dashboard shows comes from this cache, so pages work offline and outlive
// GitHub's artifact retention.
const filesOf = (ctx: Pick<ExtensionContextBase, "extensionFiles">) => {
  if (!ctx.extensionFiles) throw new Error("Benchmark results need a project with extension storage.");
  return ctx.extensionFiles;
};

export const changed = (ctx: StoreContext, runId?: string) =>
  ctx.events.emit(benchmarksChanged, runId ? { runId } : {});

export const readRuns = async (ctx: Pick<ExtensionContextBase, "extensionFiles">) => {
  const files = filesOf(ctx);
  if (!(await files.exists(RUNS_FILE))) return [];
  // Runs cached before commits and platforms were recorded read them from their title.
  return (JSON.parse(await files.readText(RUNS_FILE)) as RunRecord[]).map((run) => ({
    ...parseRunTitle(run.title),
    ...run,
  }));
};

export const writeRuns = (ctx: Pick<ExtensionContextBase, "extensionFiles">, runs: RunRecord[]) =>
  filesOf(ctx).writeText(RUNS_FILE, `${JSON.stringify(runs, null, 2)}\n`);

export type RunPatch = Partial<RunRecord> & Pick<RunRecord, "id">;
let runsWrite: Promise<unknown> = Promise.resolve();

// Pages, follows, schedules and starts update runs at the same time. Each write merges into the latest file in
// turn, so a slow sync cannot drop a run another writer added or a SHA it resolved.
export const patchRuns = (ctx: Pick<ExtensionContextBase, "extensionFiles">, patches: RunPatch[]) => {
  const write = runsWrite.then(async () => {
    const runs = new Map((await readRuns(ctx)).map((run) => [run.id, run]));
    for (const patch of patches) {
      const existing = runs.get(patch.id);
      if (!existing && !patch.title) continue;
      const merged = { ...existing, ...patch } as RunRecord;
      merged.commits = (merged.commits ?? []).map((commit) => ({
        ...commit,
        sha: commit.sha ?? existing?.commits.find((entry) => entry.ref === commit.ref)?.sha,
      }));
      runs.set(patch.id, merged);
    }
    await writeRuns(
      ctx,
      [...runs.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    );
  });
  runsWrite = write.catch(() => undefined);
  return write;
};

export const readReleases = async (ctx: Pick<ExtensionContextBase, "extensionFiles">) => {
  const files = filesOf(ctx);
  if (!(await files.exists(RELEASES_FILE))) return [];
  return JSON.parse(await files.readText(RELEASES_FILE)) as ReleaseRecord[];
};

// The last sync that finished without errors, so pages can say how fresh cached results are.
export const readSyncedAt = async (ctx: Pick<ExtensionContextBase, "extensionFiles">) => {
  const files = filesOf(ctx);
  if (!(await files.exists(SYNC_FILE))) return undefined;
  return (JSON.parse(await files.readText(SYNC_FILE)) as { syncedAt: string }).syncedAt;
};

export interface CachedResult {
  source: { kind: "release"; version: string } | { kind: "run"; runId: string };
  file: BenchmarkResultFile;
}

const sourceKey = (result: CachedResult) =>
  result.source.kind === "release" ? `release:${result.source.version}` : `run:${result.source.runId}`;

// CI measures each suite in its own job, so one commit and platform can arrive as several files.
export const mergeResults = (results: CachedResult[]) => {
  const merged = new Map<string, CachedResult>();
  for (const result of results) {
    const key = `${sourceKey(result)}|${result.file.commit.sha}|${result.file.platform}`;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, { source: result.source, file: { ...result.file } });
      continue;
    }
    const suites = [...existing.file.suites, ...result.file.suites];
    existing.file.suites = suites.filter(
      (suite, index) => suites.findIndex((entry) => entry.id === suite.id) === index,
    );
    existing.file.metrics = [...existing.file.metrics, ...result.file.metrics];
  }
  return [...merged.values()];
};

export const readResults = async (ctx: Pick<ExtensionContextBase, "extensionFiles">) => {
  const files = filesOf(ctx);
  // Result files sit at benchmarks/<releases|runs>/<id>/<file>.json, beside the runs index.
  const entries = (await files.list("benchmarks/**/*.json")).filter((entry) => entry.path.split("/").length === 4);
  const results = await Promise.all(
    entries.map(async (entry): Promise<CachedResult> => {
      const [, kind, id] = entry.path.split("/");
      const file = parseResultFile(await files.readText(entry.path));
      if (kind === "releases") return { source: { kind: "release", version: id }, file };
      return { source: { kind: "run", runId: id }, file };
    }),
  );
  return mergeResults(results);
};

const syncReleases = async (ctx: StoreContext) => {
  const files = filesOf(ctx);
  const records: ReleaseRecord[] = [];
  for (const release of await listReleases(ctx)) {
    const version = release.tag.match(STABLE_TAG)?.[1];
    if (!version) continue;
    records.push({
      version,
      publishedAt: release.publishedAt,
      platforms: release.assets.flatMap((asset) => asset.name.match(RELEASE_ASSET)?.[1] ?? []),
    });
    for (const asset of release.assets) {
      const platform = asset.name.match(RELEASE_ASSET)?.[1];
      const path = `benchmarks/releases/${version}/${platform}.json`;
      if (!platform || (await files.exists(path))) continue;
      const text = await downloadReleaseAsset(ctx, asset.id);
      parseResultFile(text);
      await files.writeText(path, text);
    }
  }
  await files.writeText(RELEASES_FILE, `${JSON.stringify(records, null, 2)}\n`);
};

const jsonFilesIn = async (dir: string): Promise<string[]> => {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return jsonFilesIn(path);
      return entry.name.endsWith(".json") ? [path] : [];
    }),
  );
  return nested.flat();
};

// Finished runs may still carry results from the platforms that passed.
const cacheRunArtifacts = async (ctx: StoreContext, runId: string) => {
  const files = filesOf(ctx);
  const commits = new Map<string, string>();
  const artifacts = (await listRunArtifacts(ctx, runId)).filter(
    (artifact) => RUN_ARTIFACT.test(artifact.name) && !artifact.expired,
  );
  for (const artifact of artifacts) {
    const dir = await mkdtemp(join(tmpdir(), "pstdio-benchmarks-"));
    try {
      await downloadRunArtifact(ctx, runId, artifact.name, dir);
      for (const path of await jsonFilesIn(dir)) {
        const text = await readFile(path, "utf8");
        const result = parseResultFile(text);
        if (result.commit.ref) commits.set(result.commit.ref, result.commit.sha);
        await files.writeText(`benchmarks/runs/${runId}/${artifact.name}-${result.commit.sha}.json`, text);
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
  return commits;
};

// The listing knows only refs; SHAs resolved at start or read from results stay.
export const mergeRun = (previous: RunRecord | undefined, run: WorkflowRun): RunRecord => ({
  ...previous,
  ...run,
  commits: run.commits.map((commit) => ({
    ...previous?.commits?.find((entry) => entry.ref === commit.ref),
    ...commit,
  })),
  synced: previous?.synced ?? false,
});

const syncRun = async (ctx: StoreContext, run: RunRecord) => {
  // Open runs and newly finished ones read their jobs, so status details stay current.
  if (!run.synced) Object.assign(run, await runProgress(ctx, run.id));
  if (run.synced || !finished(run.status)) return;
  try {
    const shas = await cacheRunArtifacts(ctx, run.id);
    // A release run is titled by its tag but records the SHA it measured, so a lone commit takes the lone SHA.
    const only = run.commits.length === 1 && shas.size === 1 ? [...shas.values()][0] : undefined;
    run.commits = run.commits.map((commit) => ({ ...commit, sha: shas.get(commit.ref) ?? commit.sha ?? only }));
    run.synced = true;
    delete run.syncError;
  } catch (error) {
    run.syncError = `Results could not be downloaded: ${error instanceof Error ? error.message : String(error)}`;
  }
};

// A run that cannot be read or downloaded keeps its error on its own row and retries on the next sync; only
// failing to reach GitHub at all fails the sync.
export const syncRuns = async (ctx: StoreContext) => {
  const previous = new Map((await readRuns(ctx)).map((run) => [run.id, run]));
  const listed = await listRuns(ctx);
  for (const run of listed) previous.set(run.id, mergeRun(previous.get(run.id), run));
  const runs = [...previous.values()];
  for (const run of runs) {
    await syncRun(ctx, run).catch((error: unknown) => {
      run.syncError = `Run status could not be read: ${error instanceof Error ? error.message : String(error)}`;
    });
  }
  await patchRuns(ctx, runs);
};

// Releases and runs sync independently, so one failing does not hide the other's new results.
export const syncAll = async (ctx: StoreContext) => {
  const outcomes = await Promise.allSettled([syncReleases(ctx), syncRuns(ctx)]);
  const failures = outcomes.flatMap((outcome) =>
    outcome.status === "rejected"
      ? [outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason)]
      : [],
  );
  if (!failures.length)
    await filesOf(ctx).writeText(SYNC_FILE, `${JSON.stringify({ syncedAt: new Date().toISOString() })}\n`);
  await changed(ctx);
  if (failures.length) throw new Error(failures.join("\n"));
};

export const refreshRun = async (ctx: StoreContext, runId: string) => {
  const progress = await runProgress(ctx, runId);
  await patchRuns(ctx, [{ id: runId, ...progress }]);
  await changed(ctx, runId);
  return progress.status;
};

export const stopRun = async (ctx: StoreContext, runId: string) => {
  await cancelRun(ctx, runId);
  await refreshRun(ctx, runId);
};
