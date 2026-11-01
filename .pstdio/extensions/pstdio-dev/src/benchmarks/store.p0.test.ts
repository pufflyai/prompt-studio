import { describe, expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createMemoryRepoFiles, createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import type { BenchmarkResultFile } from "./result-file";
import { readReleases, readResults, readRuns, readSyncedAt, syncAll, writeRuns } from "./store";

const result = (sha: string, suite = "storage"): BenchmarkResultFile => ({
  format: 1,
  commit: { sha },
  platform: "linux-x64",
  runner: "ubuntu-24.04",
  startedAt: "2026-10-22T10:00:00.000Z",
  finishedAt: "2026-10-22T11:00:00.000Z",
  suites: [{ id: suite, label: suite, source: `packages/${suite}` }],
  metrics: [{ suite, metric: `${suite}-metric`, label: suite, unit: "ms", values: [9, 8.8, 8.9] }],
});

// Run 8 is still running its runtime job; every other run has finished.
const runView = (runId: string) => {
  const running = runId === "8";
  return {
    status: running ? "in_progress" : "completed",
    conclusion: running ? null : "success",
    jobs: [
      {
        name: "linux-x64 · storage",
        status: "completed",
        conclusion: "success",
        steps: [{ name: "Run benchmarks", status: "completed", conclusion: "success" }],
      },
      {
        name: "linux-x64 · runtime",
        status: running ? "in_progress" : "completed",
        conclusion: running ? null : "success",
        steps: [{ name: "Run benchmarks", status: running ? "in_progress" : "completed", conclusion: null }],
      },
    ],
  };
};

// gh is the boundary to GitHub, so the test answers its commands the way GitHub does.
const github = () => {
  const calls: string[][] = [];
  const answer = async (args: string[]) => {
    const [command, path] = args;
    if (command === "api" && path === "repos/{owner}/{repo}/releases?per_page=100")
      return [
        {
          tag_name: "pstdio@0.46.0",
          published_at: "2026-10-22",
          draft: false,
          assets: [{ id: 1, name: "benchmarks-linux-x64.json" }],
        },
        {
          tag_name: "pstdio@0.46.1-nightly.1",
          published_at: "2026-10-23",
          draft: false,
          assets: [{ id: 2, name: "benchmarks-linux-x64.json" }],
        },
        {
          tag_name: "pstdio@0.47.0",
          published_at: null,
          draft: true,
          assets: [{ id: 3, name: "benchmarks-linux-x64.json" }],
        },
      ];
    if (command === "api" && path === "repos/{owner}/{repo}/releases/assets/1") return result("release-sha");
    if (command === "run" && path === "list")
      return [
        {
          databaseId: 7,
          displayTitle: "Benchmarks a,b on linux-x64",
          status: "completed",
          conclusion: "success",
          url: "https://github.com/runs/7",
          createdAt: "2026-10-22T09:00:00Z",
          updatedAt: "2026-10-22T10:00:00Z",
        },
        {
          databaseId: 8,
          displayTitle: "Benchmarks c on linux-x64,win32-x64",
          status: "in_progress",
          conclusion: null,
          url: "https://github.com/runs/8",
          createdAt: "2026-10-22T11:00:00Z",
          updatedAt: "2026-10-22T11:05:00Z",
        },
      ];
    if (command === "api" && path === "repos/{owner}/{repo}/actions/runs/7/artifacts")
      return {
        artifacts: [
          { id: 70, name: "benchmark-results-linux-x64-storage", expired: false },
          { id: 71, name: "benchmark-results-linux-x64-runtime", expired: false },
        ],
      };
    if (command === "run" && path === "view") return runView(args[2]);
    if (command === "run" && path === "download") {
      const dir = args[args.indexOf("--dir") + 1];
      const suite = args[args.indexOf("--name") + 1].split("-").at(-1);
      await writeFile(join(dir, "base-linux-x64.json"), JSON.stringify(result("base", suite)));
      await writeFile(join(dir, "head-linux-x64.json"), JSON.stringify(result("head", suite)));
      return "";
    }
    throw new Error(`Unexpected gh ${args.join(" ")}`);
  };
  const run = async (input: { command: string[] }) => {
    const args = input.command.slice(1);
    calls.push(args);
    const value = await answer(args);
    return { exitCode: 0, stdout: typeof value === "string" ? value : JSON.stringify(value), stderr: "" };
  };
  return { calls, run };
};

const setup = () => {
  const gh = github();
  const ctx = makeCommandContext({
    storage: createMemoryStorage(),
    params: {},
    overrides: {
      process: { run: gh.run as never },
      extensionFiles: createMemoryRepoFiles() as never,
      events: { emit: async () => ({ delivered: 1 }) as never },
    },
  });
  return { ctx, gh };
};

describe("benchmark result cache", () => {
  test("caches stable releases and finished runs, and reads them back", async () => {
    const { ctx } = setup();
    await syncAll(ctx);
    const results = await readResults(ctx);
    expect(results.map((entry) => [entry.source, entry.file.commit.sha])).toEqual([
      [{ kind: "release", version: "0.46.0" }, "release-sha"],
      [{ kind: "run", runId: "7" }, "base"],
      [{ kind: "run", runId: "7" }, "head"],
    ]);
    // Each suite ran as its own job; a commit's files merge into one result.
    expect(results[1].file.suites.map((suite) => suite.id).sort()).toEqual(["runtime", "storage"]);
    expect(results[1].file.metrics.map((metric) => metric.metric).sort()).toEqual(["runtime-metric", "storage-metric"]);
    const runs = await readRuns(ctx);
    expect(runs.map((run) => [run.id, run.status, run.synced])).toEqual([
      ["8", "running", false],
      ["7", "succeeded", true],
    ]);
  });

  test("records what each run measures, its suites' outcomes, releases, and the sync time", async () => {
    const { ctx } = setup();
    await syncAll(ctx);
    const [running, done] = await readRuns(ctx);
    expect(running).toMatchObject({
      commits: [{ ref: "c" }],
      platforms: ["linux-x64", "win32-x64"],
      detail: "Storage finished\nRuntime running",
    });
    expect(done.commits).toEqual([{ ref: "a" }, { ref: "b" }]);
    expect(await readReleases(ctx)).toEqual([
      { version: "0.46.0", publishedAt: "2026-10-22", platforms: ["linux-x64"] },
    ]);
    expect(await readSyncedAt(ctx)).toBeString();
  });

  test("does not download cached results again", async () => {
    const { ctx, gh } = setup();
    await syncAll(ctx);
    const downloads = () => gh.calls.filter((args) => args[0] === "run" && args[1] === "download").length;
    expect(downloads()).toBe(2);
    await syncAll(ctx);
    expect(downloads()).toBe(2);
    expect(gh.calls.filter((args) => args[1] === "repos/{owner}/{repo}/releases/assets/1")).toHaveLength(1);
  });

  test("a run that cannot sync does not stop the others", async () => {
    const { ctx } = setup();
    // Run 6 has dropped out of GitHub's recent list and its artifacts can no longer be listed.
    await writeRuns(ctx, [
      {
        id: "6",
        title: "Benchmarks old on linux-x64",
        status: "succeeded",
        commits: [{ ref: "old" }],
        platforms: ["linux-x64"],
        url: "https://github.com/runs/6",
        createdAt: "2026-10-20T09:00:00Z",
        updatedAt: "2026-10-20T10:00:00Z",
        synced: false,
      },
    ]);
    await expect(syncAll(ctx)).rejects.toThrow("Run 6");
    // A failed sync keeps the last successful sync time, which is none yet.
    expect(await readSyncedAt(ctx)).toBeUndefined();
    const runs = await readRuns(ctx);
    expect(runs.find((run) => run.id === "6")?.syncError).toStartWith("Results could not be downloaded");
    expect(runs.map((run) => [run.id, run.synced])).toEqual([
      ["8", false],
      ["7", true],
      ["6", false],
    ]);
    expect((await readResults(ctx)).some((entry) => entry.file.commit.sha === "head")).toBe(true);
  });
});
