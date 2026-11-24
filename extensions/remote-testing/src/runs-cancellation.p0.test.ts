import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionAutomationApi, ExtensionConnectionsApi } from "@pstdio/sdk/extensions";
import { createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import { commands } from "./commands";
import { type Api, PocketCoderError } from "./connection";
import { runDeps } from "./context";
import { cleanupRunEnvironment, enqueueEnvironmentCleanup } from "./environment-cleanup";
import { activeRun, claimEnvironment } from "./environments";
import { localProcess } from "./process-fixture";
import { listRuns, startRun } from "./runs";

let root: string;
beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "remote-testing-cancel-"));
  await writeFile(join(root, "source.txt"), "source");
  for (const args of [
    ["init", "-q"],
    ["add", "."],
    ["-c", "user.name=test", "-c", "user.email=test@example.com", "commit", "-qm", "source"],
  ])
    await localProcess.runOrThrow({ command: ["git", "-C", root, ...args] });
});
afterAll(() => rm(root, { recursive: true, force: true }));

test.each([
  {},
  { branchTemplate: true },
  { kind: "preview" as const },
  { environmentId: "env" },
])("canceled provisioning is cleaned by an independently scoped automation (%j)", async (input) => {
  const store = createMemoryStorage();
  const parent = new AbortController();
  const entered = Promise.withResolvers<void>();
  const queued: Parameters<ExtensionAutomationApi["enqueue"]>[0][] = [];
  const stops: string[] = [];
  let submissions = 0;
  const scopedRequest =
    (signal: AbortSignal): ExtensionConnectionsApi["request"] =>
    async <TBody>(_id: string, request: Parameters<ExtensionConnectionsApi["request"]>[1]) => {
      const effective = request.signal ? AbortSignal.any([signal, request.signal]) : signal;
      effective.throwIfAborted();
      if (request.path.includes("/changes?")) {
        entered.resolve();
        return new Promise<never>((_resolve, reject) => {
          effective.addEventListener("abort", () => reject(effective.reason), { once: true });
        });
      }
      if (request.path.endsWith("/cancel")) stops.push(request.path);
      if (request.path.endsWith("/requests")) submissions++;
      return {
        status: 200,
        headers: {},
        body: {
          id: "env",
          state: "provisioning",
          change_cursor: 0,
          metadata: { pstdio_project_id: "project" },
        } as TBody,
      };
    };
  const ctx = makeCommandContext({
    storage: store,
    params: {},
    projectId: "project",
    overrides: {
      extensionId: "pocketcoder.remote-testing",
      signal: parent.signal,
      process: localProcess,
      connections: { request: scopedRequest(parent.signal) },
      settings: { all: async () => ({ templateVersion: "1", storageBucket: "fixture", signerAccount: "fixture" }) },
      automation: {
        enqueue: async (job) => {
          queued.push(job);
          return {
            id: "cleanup-job",
            projectId: "project",
            commandId: "environments.cleanup-run",
            status: "queued",
            createdAt: new Date().toISOString(),
            startedAt: null,
            finishedAt: null,
            result: null,
            error: null,
          };
        },
      },
    },
  });
  const deps = {
    ...(await runDeps(ctx)),
    publishTemplate: async () => ({ name: "branch", version: "1" }),
    storage: { upload: async () => {}, signedUrl: async () => "http://localhost/source", download: async () => null },
  };
  const pending = startRun(deps, { root, ...input }, parent.signal);
  void pending.catch((error) => entered.reject(error));
  await entered.promise;
  const reason = new Error("Invocation canceled");
  parent.abort(reason);
  await expect(pending).rejects.toBe(reason);
  expect(queued).toHaveLength(1);
  const job = queued[0]!;
  expect(job.command).toMatchObject({ id: "environments.cleanup-run" });
  expect(job.input.params).toMatchObject({ environmentId: "env", stop: !("environmentId" in input) });
  const runId = job.input.params?.runId;
  if (typeof runId !== "string") throw new Error("Cleanup needs a run ID");
  expect(await activeRun(store, "env")).toBe(runId);
  expect(stops).toEqual([]);
  expect(submissions).toBe(0);
  expect(await listRuns(store)).toEqual([]);
  const worker = new AbortController();
  const workerCtx = makeCommandContext({
    storage: store,
    params: {},
    projectId: "project",
    overrides: {
      extensionId: ctx.extensionId,
      signal: worker.signal,
      connections: { request: scopedRequest(worker.signal) },
      events: {
        emit: async () => {
          throw new Error("Notification unavailable");
        },
      },
    },
  });
  const cleanup = commands.find((command) => command.id === "environments.cleanup-run");
  if (!cleanup) throw new Error("Cleanup automation is not registered");
  await cleanup.run(workerCtx, job.input.params as never);
  expect(stops).toHaveLength("environmentId" in input ? 0 : 1);
  expect(await activeRun(store, "env")).toBeNull();
  await cleanup.run(workerCtx, job.input.params as never);
  expect(stops).toHaveLength("environmentId" in input ? 0 : 1);
});

test("cleanup preserves another owner's claim", async () => {
  const store = createMemoryStorage();
  await claimEnvironment(store, "env", "other");
  let stops = 0;
  const api: Api = async () => {
    stops++;
    return {} as never;
  };
  expect(await cleanupRunEnvironment({ api, store }, { environmentId: "env", runId: "old", stop: true })).toEqual({
    stopped: false,
  });
  expect(stops).toBe(0);
  expect(await store.collection("environment-claims").get("env")).toMatchObject({ runId: "other" });
});

test("failed cleanup retains the owning claim and can resume safely", async () => {
  const store = createMemoryStorage();
  await claimEnvironment(store, "env", "owner");
  const failure = new PocketCoderError(401, "Sign in again");
  let failing = true;
  const api: Api = async () => {
    expect(await activeRun(store, "env")).toBe("owner");
    expect(await claimEnvironment(store, "env", "competitor")).toBe(false);
    if (failing) throw failure;
    return {} as never;
  };
  const input = { environmentId: "env", runId: "owner", stop: true };
  await expect(cleanupRunEnvironment({ api, store }, input)).rejects.toBe(failure);
  expect(await activeRun(store, "env")).toBe("owner");
  failing = false;
  expect(await cleanupRunEnvironment({ api, store }, input)).toEqual({ stopped: true });
  expect(await activeRun(store, "env")).toBeNull();
});

test("an unavailable cleanup queue reports the environment and preserves its error", async () => {
  const failure = new Error("Queue unavailable");
  const logs: string[] = [];
  const canceled = new AbortController();
  canceled.abort();
  const ctx = makeCommandContext({
    storage: createMemoryStorage(),
    params: {},
    overrides: {
      signal: canceled.signal,
      automation: {
        enqueue: async () => {
          throw failure;
        },
      },
      logger: {
        error: (message) => {
          logs.push(message);
        },
      },
    },
  });
  await claimEnvironment(ctx.storage, "env", "run");
  await expect(enqueueEnvironmentCleanup(ctx, { environmentId: "env", runId: "run", stop: true })).rejects.toBe(
    failure,
  );
  expect(logs).toHaveLength(1);
  expect(logs[0]).toContain("environment env");
  expect(logs[0]).toContain("run run");
});
