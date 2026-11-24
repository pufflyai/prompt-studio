import { expect, spyOn, test } from "bun:test";
import type { ExtensionAutomationApi, ExtensionConnectionsApi } from "@pstdio/sdk/extensions";
import { makeCommandContext } from "@pstdio/sdk/testing";
import { collectRun, startCollection } from "./collection";
import { recoverEnvironmentCleanup } from "./environment-cleanup";
import { activeRun, claimEnvironment } from "./environments";
import { createRunStorage } from "./run-storage-fixture";
import type { RunRecord } from "./runs";

test.each([
  "after receipt",
  "worker setup claim",
])("collection survives a transient local state read failure (%s)", async (stage) => {
  const store = createRunStorage();
  const runId = "run";
  const environmentId = "env";
  const record: RunRecord = {
    runId,
    environmentId,
    requestId: "request",
    conversationId: "conversation",
    root: "/",
    command: "bun test",
    startedAt: new Date().toISOString(),
    timeoutSeconds: 600,
    stopAfterRun: false,
  };
  await store.set("run:run", record);
  await claimEnvironment(store, environmentId, runId);
  const get = store.get;
  let allowFailure = false;
  let failures = 0;
  let receipts = 0;
  store.get = async <T>(key: string) => {
    if (stage === "after receipt" && key === "run:run" && allowFailure && failures === 0) {
      failures++;
      throw new Error("One transient result state read failure");
    }
    return get<T>(key);
  };

  let workerStarted = false;
  const collection = store.collection.bind(store);
  store.collection = <T>(name: string) => {
    const current = collection<T>(name);
    return {
      ...current,
      get: async (id: string) => {
        if (
          stage === "worker setup claim" &&
          name === "environment-claims" &&
          workerStarted &&
          receipts === 0 &&
          failures === 0
        ) {
          failures++;
          throw new Error("One transient worker setup state read failure");
        }
        return current.get(id);
      },
    };
  };

  type Job = NonNullable<Awaited<ReturnType<ExtensionAutomationApi["get"]>>>;
  const jobs = new Map<string, Job>();
  const request: ExtensionConnectionsApi["request"] = async <T>() => {
    receipts++;
    allowFailure = true;
    return {
      status: 200,
      headers: {},
      body: {
        finalizedAt: new Date().toISOString(),
        acceptance: { execution: {} },
        outcome: { finalResponse: 'REMOTE_TEST_RESULT {"exitCode":0,"durationMs":17,"timedOut":false}' },
      } as T,
    };
  };
  const ctx = makeCommandContext({
    storage: store,
    params: {},
    overrides: {
      settings: { all: async () => ({ templateVersion: "1", storageBucket: "fixture", signerAccount: "fixture" }) },
      connections: { request },
      process: { run: async () => ({ exitCode: 0, stdout: "fixture-token", stderr: "" }) },
      extensionFiles: { writeText: async () => {} },
      automation: {
        get: async (id) => jobs.get(id),
        enqueue: async (input) => {
          const id = input.key;
          const job: Job = {
            id,
            projectId: "project",
            commandId: "runs.collect",
            status: "queued",
            createdAt: new Date().toISOString(),
            startedAt: null,
            finishedAt: null,
            result: null,
            error: null,
          };
          jobs.set(id, job);
          return job;
        },
      },
    },
  });

  const fetchTarget: { fetch: (...args: Parameters<typeof fetch>) => ReturnType<typeof fetch> } = globalThis;
  const download = spyOn(fetchTarget, "fetch").mockImplementation(async () => new Response("actual log"));
  try {
    const id = await startCollection(ctx, runId);
    const job = jobs.get(id)!;
    job.status = "running";
    workerStarted = true;
    try {
      job.result = await collectRun.run(ctx, { runId });
      job.status = "succeeded";
    } catch (error) {
      job.status = "failed";
      job.error = { code: "command_failed", message: String(error), retryable: false };
    }
    allowFailure = false;
    await recoverEnvironmentCleanup.run(ctx, {});
    const saved = await store.get<RunRecord>("run:run");
    expect(receipts).toBe(1);
    expect(failures).toBe(1);
    expect(saved?.summary).toMatchObject({ status: "passed", durationMs: 17 });
    expect(await activeRun(store, environmentId)).toBeNull();
  } finally {
    download.mockRestore();
  }
});
