import { describe, expect, test } from "bun:test";
import { createMemoryRepoFiles, createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import { benchmarkCommands } from "./commands";
import type { BenchmarkResultFile } from "./result-file";
import { readRuns } from "./store";

const measured = (sha: string): BenchmarkResultFile => ({
  format: 1,
  commit: { sha, ref: "pstdio@0.45.0" },
  platform: "linux-x64",
  runner: "ubuntu-24.04",
  startedAt: "2026-11-01T09:00:00.000Z",
  finishedAt: "2026-11-01T09:06:00.000Z",
  suites: [
    { id: "storage", label: "Storage", source: "packages/pstdio-db" },
    { id: "runtime", label: "Runtime", source: "packages/pstdio-api" },
  ],
  metrics: [{ suite: "storage", metric: "badge-query", label: "Badges", unit: "ms", values: [9] }],
});

// gh api --paginate --jq prints one JSON value per line; the mocks answer as GitHub would and apply the jq.
const paged = (args: string[], value: unknown) => {
  if (!args.includes("--paginate")) return value;
  type Refs = { data?: { repository: { refs: { nodes: { name: string; target: { oid: string } }[] } } } };
  const refs = (value as Refs).data?.repository.refs.nodes.map((node) => ({ name: node.name, sha: node.target.oid }));
  const list = Array.isArray(value) ? value : (refs ?? (value as { artifacts: unknown[] }).artifacts);
  return list.map((entry) => JSON.stringify(entry)).join("\n");
};
const withoutPaging = (args: string[]) =>
  args.filter((arg, index) => arg !== "--paginate" && arg !== "--jq" && args[index - 1] !== "--jq");

const listedRun = (id: number, title: string, status: string) => ({
  databaseId: id,
  displayTitle: title,
  status,
  conclusion: status === "completed" ? "success" : null,
  url: `https://github.com/runs/${id}`,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

// gh and git are the boundaries, so the test answers them the way GitHub and a clone do. gh prints no run URL,
// so a start has to find its run in the listing.
const setup = (options: { releasesFail?: boolean } = {}) => {
  const calls: string[][] = [];
  const listed = [listedRun(5, "Benchmarks pstdio@0.45.0 on linux-x64", "completed")];
  const shas: Record<string, string> = { main: "main-sha", "pstdio@0.45.0": "tag-sha" };
  const answers: Record<string, (args: string[]) => unknown> = {
    "api commits": (args) => {
      const sha = shas[args[1].split("/commits/")[1]];
      if (!sha) throw new Error("No commit found");
      return sha;
    },
    "api graphql": () => ({ data: { repository: { refs: { nodes: [] } } } }),
    "workflow run": (args) => {
      listed.unshift(listedRun(9, `Benchmarks ${args[4].slice(8)} on ${args[8].slice(10)}`, "queued"));
      return "";
    },
    "run list": () => listed,
    "run view": (args) =>
      args[2] === "5"
        ? { status: "completed", conclusion: "success", jobs: [] }
        : { status: "queued", conclusion: null, jobs: [] },
    "api releases": () => {
      if (options.releasesFail) throw new Error("GitHub could not be reached.");
      return [];
    },
    "api artifacts": () => ({ artifacts: [] }),
  };
  const answer = (args: string[]) => {
    const [command, second] = args;
    let path = command === "api" ? (second.split("?")[0].split("/").at(-1) ?? "") : second;
    if (second.includes("/commits/")) path = "commits";
    const handler = answers[`${command} ${path}`];
    if (!handler) throw new Error(`Unexpected ${args.join(" ")}`);
    return handler(args);
  };
  const run = async (input: { command: string[] }) => {
    const args = input.command.slice(1);
    calls.push(input.command);
    try {
      const value = paged(args, answer(withoutPaging(args)));
      if (value === undefined) return { exitCode: 1, stdout: "", stderr: "" };
      return { exitCode: 0, stdout: typeof value === "string" ? value : JSON.stringify(value), stderr: "" };
    } catch (error) {
      return { exitCode: 1, stdout: "", stderr: (error as Error).message };
    }
  };
  const automations = new Map<string, { id: string; status: string }>();
  const automation = {
    enqueue: async () => {
      const entry = { id: `follow-${automations.size + 1}`, status: "queued" };
      automations.set(entry.id, entry);
      return entry;
    },
    get: async (id: string) => automations.get(id),
  };
  const files = createMemoryRepoFiles();
  const ctx = makeCommandContext({
    storage: createMemoryStorage(),
    params: {},
    overrides: {
      process: { run: run as never },
      extensionFiles: files as never,
      events: { emit: async () => ({ delivered: 1 }) as never },
      automation: automation as never,
    },
  });
  return { ctx, files, calls, automations };
};

const startRun = (ctx: unknown, params: Record<string, unknown>) =>
  benchmarkCommands["benchmarks.start-run"].run(ctx as never, params as never);

describe("starting a benchmark run", () => {
  test("reuses measured commits, dispatches the rest once, and follows the run", async () => {
    const { ctx, files, calls, automations } = setup();
    await files.writeText("benchmarks/runs/5/storage-tag-sha.json", JSON.stringify(measured("tag-sha")));
    const result = await startRun(ctx, {
      commits: ["pstdio@0.45.0", "main"],
      suites: ["storage", "runtime"],
      platforms: ["linux-x64"],
    });
    expect(result).toMatchObject({ dispatched: true, runId: "9", skipped: [] });
    expect(result.reused.map((commit) => commit.ref)).toEqual(["pstdio@0.45.0"]);
    const dispatch = calls.find((command) => command[1] === "workflow");
    expect(dispatch).toContain("commits=main");
    expect(dispatch?.some((argument) => argument.startsWith("samples="))).toBe(false);
    const run = (await readRuns(ctx)).find((entry) => entry.id === "9");
    expect(run).toMatchObject({ commits: [{ ref: "main", sha: "main-sha" }], followId: "follow-1" });
    expect(automations.size).toBe(1);
  });

  test("starts nothing when every commit already has results", async () => {
    const { ctx, files, calls } = setup();
    await files.writeText("benchmarks/runs/5/storage-tag-sha.json", JSON.stringify(measured("tag-sha")));
    const result = await startRun(ctx, { commits: ["pstdio@0.45.0"], suites: ["storage"] });
    expect(result).toMatchObject({ dispatched: false, runId: undefined });
    expect(calls.some((command) => command[1] === "workflow")).toBe(false);
  });

  test("names suite and platform pairs CI will skip, and rejects unknown platforms", async () => {
    const { ctx } = setup();
    const result = await startRun(ctx, { commits: ["main"], suites: ["relay"], platforms: ["linux-x64", "win32-x64"] });
    expect(result.skipped).toEqual([{ suite: "relay", platform: "win32-x64", reason: "Needs Linux x64 and Docker" }]);
    await expect(startRun(ctx, { commits: ["main"], platforms: ["linux-arm64"] })).rejects.toThrow(
      "Unknown platforms: linux-arm64",
    );
  });
});

describe("syncing benchmark results", () => {
  test("follows open runs even when the sync fails, once per live follower", async () => {
    const { ctx, automations } = setup({ releasesFail: true });
    await startRun(ctx, { commits: ["main"], suites: ["storage"] });
    const sync = () => benchmarkCommands["benchmarks.sync"].run(ctx as never, {} as never);
    await expect(sync()).rejects.toThrow("GitHub could not be reached.");
    expect(automations.size).toBe(1);
    // A follower that ended without finishing the run is replaced on the next sync.
    const follower = automations.get("follow-1");
    if (follower) follower.status = "failed";
    await expect(sync()).rejects.toThrow("GitHub could not be reached.");
    expect(automations.size).toBe(2);
    expect((await readRuns(ctx)).find((run) => run.id === "9")?.followId).toBe("follow-2");
  });
});
