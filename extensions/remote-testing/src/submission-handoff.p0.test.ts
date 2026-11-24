import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionAutomationApi } from "@pstdio/sdk/extensions";
import { makeCommandContext } from "@pstdio/sdk/testing";
import { collectRun } from "./collection";
import { type Api, PocketCoderError } from "./connection";
import { cleanupEnvironmentCommand, enqueueEnvironmentCleanup, recoverEnvironmentCleanup } from "./environment-cleanup";
import { activeRun, claimEnvironment, releaseEnvironment } from "./environments";
import { localProcess } from "./process-fixture";
import { unfinishedRuns } from "./run-recovery";
import { createRunStorage } from "./run-storage-fixture";
import { listRuns, type RunDeps, type RunRecord, startRun } from "./runs";

const commandId = (command: Parameters<ExtensionAutomationApi["enqueue"]>[0]["command"]) =>
  typeof command === "string" ? command : command.id;

let root: string;
beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "remote-rejection-handoff-"));
  await localProcess.runOrThrow({ command: ["git", "-C", root, "init", "-q"] });
  await Bun.write(join(root, "source.txt"), "source");
});
afterAll(() => rm(root, { recursive: true, force: true }));

test.each([
  { kept: true, failure: "before handoff" },
  { kept: true, failure: "after handoff" },
  { kept: true, failure: "replaced claim" },
  { kept: false, failure: "before handoff" },
  { kept: false, failure: "after handoff" },
  { kept: false, failure: "replaced claim" },
])("a definitive rejection remains recoverable through result-to-cleanup handoff (%j)", async ({ kept, failure }) => {
  const store = createRunStorage();
  const requests: string[] = [];
  let state = "ready";
  const api: Api = async ({ method, path }) => {
    requests.push(`${method} ${path}`);
    if (method === "POST" && path.endsWith("/requests"))
      throw new PocketCoderError(409, "Registration rejected before admission", "attachment.unsupported");
    if (path.includes("/requests/")) throw new Error("A saved rejection must not poll or replay its request");
    if (method === "POST" && path.endsWith("/cancel")) state = "canceled";
    return { id: "env", state, metadata: { pstdio_project_id: "project" } } as never;
  };
  type Job = NonNullable<Awaited<ReturnType<ExtensionAutomationApi["get"]>>>;
  const failed: Job = {
    id: "failed-collector",
    projectId: "project",
    commandId: "runs.collect",
    status: "failed",
    createdAt: new Date().toISOString(),
    startedAt: null,
    finishedAt: new Date().toISOString(),
    result: null,
    error: { code: "command_failed", retryable: false, message: "Handoff storage unavailable" },
  };
  const jobs = new Map<string, Job>([[failed.id, failed]]);
  const queued: Parameters<ExtensionAutomationApi["enqueue"]>[0][] = [];
  const ctx = makeCommandContext({
    storage: store,
    params: {},
    overrides: {
      connections: {
        request: async <T>(_id: string, input: Parameters<Api>[0]) => ({
          status: 200,
          headers: {},
          body: await api<T>(input),
        }),
      },
      automation: {
        get: async (id) => jobs.get(id),
        enqueue: async (input) => {
          queued.push(input);
          const job: Job = {
            ...failed,
            id: `job-${queued.length}`,
            commandId: commandId(input.command),
            status: "queued",
            error: null,
          };
          jobs.set(job.id, job);
          return job;
        },
      },
    },
  });
  const collection = store.collection.bind(store);
  let injected = false;
  const interrupt = async () => {
    injected = true;
    if (failure === "replaced claim") {
      const owner = await activeRun(store, "env");
      if (owner) await releaseEnvironment(store, "env", owner);
      expect(await claimEnvironment(store, "env", "replacement")).toBe(true);
    }
    throw new Error("Handoff storage unavailable");
  };
  store.collection = <T>(name: string) => {
    const current = collection<T>(name);
    return {
      ...current,
      createIfAbsent: async (id: string, value: T) => {
        if (!kept && !injected && name === "environment-cleanups") {
          if (failure === "before handoff") return interrupt();
          await current.createIfAbsent(id, value);
          return interrupt();
        }
        return current.createIfAbsent(id, value);
      },
      deleteIfValue: async (id: string, value: T) => {
        if (kept && !injected && name === "environment-claims") {
          if (failure === "before handoff") return interrupt();
          await current.deleteIfValue(id, value);
          return interrupt();
        }
        return current.deleteIfValue(id, value);
      },
    };
  };
  const deps: RunDeps = {
    projectId: "project",
    api,
    store,
    process: localProcess,
    settings: {
      templateName: "tests",
      templateVersion: "1",
      testCommand: "bun test",
      timeoutMinutes: 1,
      storageBucket: "fixture",
      signerAccount: "fixture",
    },
    storage: { upload: async () => {}, signedUrl: async () => "http://localhost/source", download: async () => null },
    saveLog: async () => "unused",
    cleanupEnvironment: (input) => enqueueEnvironmentCleanup(ctx, input),
  };
  await expect(
    startRun(deps, { root, ...(kept ? { environmentId: "env", keepEnvironment: true } : {}) }),
  ).rejects.toThrow("Handoff storage unavailable");
  const [saved] = await listRuns(store);
  expect(injected).toBe(true);
  expect(saved.summary).toMatchObject({ status: "error", error: expect.stringContaining("HTTP 409") });
  expect(saved.pendingResult).toBeDefined();
  expect(saved.pendingResult?.summary.durationMs).toBe(saved.summary!.durationMs);
  const unfinished = [];
  for await (const record of unfinishedRuns(store)) unfinished.push(record.runId);
  expect(unfinished).toEqual([saved.runId]);
  await store.collection("run-collectors").put(saved.runId, { jobId: failed.id });
  await recoverEnvironmentCleanup.run(ctx, {});
  expect(queued.some((job) => commandId(job.command) === "runs.collect")).toBe(true);
  // Execute the jobs the actual sweep admitted, including direct cleanup admitted
  // by recovered checkpoint completion. Neither path may replay a test command.
  for (let index = 0; index < queued.length; index++) {
    const input = queued[index]!;
    const job = jobs.get(`job-${index + 1}`)!;
    job.status = "running";
    if (commandId(input.command) === "runs.collect") await collectRun.run(ctx, { runId: saved.runId });
    else await cleanupEnvironmentCommand.run(ctx, input.input.params as never);
    job.status = "succeeded";
  }
  await recoverEnvironmentCleanup.run(ctx, {});
  const recovered = await store.get<RunRecord>(`run:${saved.runId}`);
  expect(recovered?.summary).toEqual(saved.summary);
  expect(recovered?.pendingResult).toBeUndefined();
  expect(await activeRun(store, "env")).toBe(failure === "replaced claim" ? "replacement" : null);
  expect(requests.filter((path) => path.endsWith("/requests"))).toHaveLength(1);
  expect(requests.filter((path) => path.endsWith("/cancel"))).toHaveLength(
    !kept && failure !== "replaced claim" ? 1 : 0,
  );
  expect(requests.filter((path) => path.includes("/requests/"))).toEqual([]);
  expect(jobs.get(failed.id)?.error).toMatchObject({ code: "command_failed", retryable: false });
});
