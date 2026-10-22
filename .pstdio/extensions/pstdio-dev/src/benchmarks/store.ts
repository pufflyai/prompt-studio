import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionContextBase } from "@pstdio/sdk/extensions";
import { benchmarksChanged } from "./events";
import {
  cancelRun,
  downloadReleaseAsset,
  downloadRunArtifact,
  listReleases,
  listRunArtifacts,
  listRuns,
  type RunStatus,
  runProgress,
  type WorkflowRun,
} from "./github";
import { type BenchmarkResultFile, parseResultFile } from "./result-file";

export type StoreContext = Pick<ExtensionContextBase, "process" | "extensionFiles" | "events">;

export interface RunRecord extends WorkflowRun {
  progress?: number;
  failure?: string;
  synced: boolean;
}

const RUNS_FILE = "benchmarks/runs.json";
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
  return JSON.parse(await files.readText(RUNS_FILE)) as RunRecord[];
};

export const writeRuns = (ctx: Pick<ExtensionContextBase, "extensionFiles">, runs: RunRecord[]) =>
  filesOf(ctx).writeText(RUNS_FILE, `${JSON.stringify(runs, null, 2)}\n`);

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
  for (const release of await listReleases(ctx)) {
    const version = release.tag.match(STABLE_TAG)?.[1];
    if (!version) continue;
    for (const asset of release.assets) {
      const platform = asset.name.match(RELEASE_ASSET)?.[1];
      const path = `benchmarks/releases/${version}/${platform}.json`;
      if (!platform || (await files.exists(path))) continue;
      const text = await downloadReleaseAsset(ctx, asset.id);
      parseResultFile(text);
      await files.writeText(path, text);
    }
  }
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
        await files.writeText(`benchmarks/runs/${runId}/${artifact.name}-${result.commit.sha}.json`, text);
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
};

export const finished = (status: RunStatus) => status === "succeeded" || status === "failed" || status === "cancelled";

export const mergeRun = (previous: RunRecord | undefined, run: WorkflowRun): RunRecord => ({
  ...previous,
  ...run,
  synced: previous?.synced ?? false,
});

const syncRun = async (ctx: StoreContext, run: RunRecord, listed: boolean) => {
  // GitHub lists only recent runs; an older run still open is asked for directly.
  if (!listed && !finished(run.status)) Object.assign(run, await runProgress(ctx, run.id));
  if (run.synced || !finished(run.status)) return;
  await cacheRunArtifacts(ctx, run.id);
  run.synced = true;
};

export const syncRuns = async (ctx: StoreContext) => {
  const previous = new Map((await readRuns(ctx)).map((run) => [run.id, run]));
  const listed = await listRuns(ctx);
  for (const run of listed) previous.set(run.id, mergeRun(previous.get(run.id), run));
  const listedIds = new Set(listed.map((run) => run.id));
  const runs = [...previous.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const failures: string[] = [];
  for (const run of runs) {
    // One run that cannot sync must not stop the others; it retries on the next sync.
    await syncRun(ctx, run, listedIds.has(run.id)).catch((error: unknown) =>
      failures.push(`Run ${run.id}: ${error instanceof Error ? error.message : String(error)}`),
    );
  }
  await writeRuns(ctx, runs);
  if (failures.length) throw new Error(failures.join("\n"));
};

export const syncAll = async (ctx: StoreContext) => {
  await syncReleases(ctx);
  await syncRuns(ctx);
  await changed(ctx);
};

export const refreshRun = async (ctx: StoreContext, runId: string) => {
  const progress = await runProgress(ctx, runId);
  const runs = await readRuns(ctx);
  const run = runs.find((entry) => entry.id === runId);
  if (run) Object.assign(run, progress);
  await writeRuns(ctx, runs);
  await changed(ctx, runId);
  return progress.status;
};

export const stopRun = async (ctx: StoreContext, runId: string) => {
  await cancelRun(ctx, runId);
  await refreshRun(ctx, runId);
};
