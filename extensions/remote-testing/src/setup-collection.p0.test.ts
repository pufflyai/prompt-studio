import { expect, spyOn, test } from "bun:test";
import type { ExtensionAutomationApi, ExtensionConnectionsApi } from "@pstdio/sdk/extensions";
import { makeCommandContext } from "@pstdio/sdk/testing";
import { collectRun, startCollection } from "./collection";
import { showRun } from "./commands";
import { PocketCoderError } from "./connection";
import { cleanupEnvironmentCommand } from "./environment-cleanup";
import { activeRun, claimEnvironment } from "./environments";
import { createRunStorage } from "./run-storage-fixture";
import { checkRun, type RunRecord } from "./runs";
import { activateEnvironment } from "./setup-claims";

type Job = NonNullable<Awaited<ReturnType<ExtensionAutomationApi["get"]>>>;
async function fixture(execute = false, setupMs = 60000, missing = false) {
  const store = createRunStorage();
  const parent = new AbortController();
  const record: RunRecord = {
    runId: "run",
    environmentId: "env",
    requestId: "request",
    conversationId: "conversation",
    root: "/",
    command: "bun test",
    startedAt: "2026-01-01T00:00:00Z",
    timeoutSeconds: 60,
    stopAfterRun: false,
    submissionPending: true,
  };
  await claimEnvironment(store, "env", "run", { until: Date.now() + setupMs, stop: false });
  await store.set("run:run", record);
  let reads = 0;
  let stops = 0;
  const queued: Parameters<ExtensionAutomationApi["enqueue"]>[0][] = [];
  const jobs = new Map<string, Job>();
  const keys = new Map<string, string>();
  const request: ExtensionConnectionsApi["request"] = async <T>(
    _id: string,
    input: Parameters<ExtensionConnectionsApi["request"]>[1],
  ) => {
    if (input.method === "POST") {
      stops++;
      throw new Error("Setup must never cancel or stop the kept workspace");
    }
    reads++;
    if (missing) return { status: 404, headers: {}, body: {} as T };
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
      signal: parent.signal,
      settings: { all: async () => ({ templateVersion: "1", storageBucket: "fixture", signerAccount: "fixture" }) },
      connections: { request },
      process: { run: async () => ({ exitCode: 0, stdout: "fixture-token", stderr: "" }) },
      extensionFiles: { writeText: async () => {} },
      automation: {
        get: async (id) => jobs.get(id),
        enqueue: async (input) => {
          const prior = keys.get(input.key);
          if (prior) return jobs.get(prior)!;
          queued.push(input);
          const id = `job-${jobs.size}`;
          const commandId = typeof input.command === "string" ? input.command : input.command.id;
          const job: Job = {
            id,
            projectId: "project",
            commandId,
            status: "queued",
            createdAt: new Date().toISOString(),
            startedAt: null,
            finishedAt: null,
            result: null,
            error: null,
          };
          jobs.set(id, job);
          keys.set(input.key, id);
          if (execute && commandId === "runs.collect")
            setTimeout(() => {
              job.status = "running";
              void Promise.resolve(collectRun.run(ctx, { runId: "run" })).then(
                (result) => {
                  job.result = result;
                  job.status = "succeeded";
                },
                (error) => {
                  job.status = "failed";
                  job.error = { code: "command_failed", message: String(error), retryable: false };
                },
              );
            }, 0);
          return job;
        },
      },
    },
  });
  return { store, record, ctx, parent, queued, jobs, reads: () => reads, stops: () => stops };
}

test("collector admission refuses live setup and admits real collection after activation", async () => {
  const f = await fixture();
  await expect(startCollection(f.ctx, "run")).rejects.toThrow("setup");
  expect(f.queued).toHaveLength(0);
  expect(await f.store.collection("run-collectors").get("run")).toBeUndefined();
  await activateEnvironment(f.store, "env", "run");
  expect(await startCollection(f.ctx, "run")).toBe("job-0");
  expect(f.queued).toHaveLength(1);
});

test("checkRun never polls or times out a matching live setup even beyond the receipt deadline", async () => {
  const f = await fixture();
  let reads = 0;
  const cleanup: unknown[] = [];
  expect(
    await checkRun(
      {
        store: f.store,
        api: async () => {
          reads++;
          throw new PocketCoderError(404, "Not submitted");
        },
        storage: { download: async () => null },
        saveLog: async () => "unused",
        cleanupEnvironment: async (input) => {
          cleanup.push(input);
        },
      },
      f.record,
    ),
  ).toBeNull();
  expect(reads).toBe(0);
  expect(cleanup).toHaveLength(0);
  expect((await f.store.get<RunRecord>("run:run"))?.summary).toBeUndefined();
  expect(await activeRun(f.store, "env")).toBe("run");
});

test.each([
  "show",
  "worker",
])("the actual %s entry waits for setup, then collects a real activated receipt", async (entry) => {
  const f = await fixture(entry === "show");
  const fetchTarget: { fetch: (...args: Parameters<typeof fetch>) => ReturnType<typeof fetch> } = globalThis;
  const download = spyOn(fetchTarget, "fetch").mockImplementation(async () => new Response("actual test output"));
  const pending = Promise.resolve(
    entry === "show" ? showRun.run(f.ctx, { runId: "run" }) : collectRun.run(f.ctx, { runId: "run" }),
  ).then(
    (value) => ({ value }),
    (error: unknown) => ({ error }),
  );
  try {
    await Bun.sleep(20);
    expect(f.queued).toHaveLength(0);
    expect(f.reads()).toBe(0);
    expect(f.stops()).toBe(0);
    expect((await f.store.get<RunRecord>("run:run"))?.summary).toBeUndefined();
    await activateEnvironment(f.store, "env", "run");
    const result = await pending;
    expect(result).not.toHaveProperty("error");
    expect((await f.store.get<RunRecord>("run:run"))?.summary).toMatchObject({
      status: "passed",
      durationMs: 17,
      tail: "actual test output",
    });
    expect(f.reads()).toBe(1);
    expect(f.stops()).toBe(0);
  } finally {
    f.parent.abort(new Error("Test finished"));
    await pending;
    download.mockRestore();
  }
});

test("explicit show recovers expired setup without a minute schedule and preserves its keep intent", async () => {
  const f = await fixture(true, 30, true);
  const pending = Promise.resolve(showRun.run(f.ctx, { runId: "run" }));
  try {
    const result = await pending;
    expect(result).toMatchObject({ status: "error", error: "Environment setup expired before request submission." });
    expect(f.reads()).toBe(0);
    expect(f.stops()).toBe(0);
    const cleanup = f.queued.find(
      (job) => typeof job.command !== "string" && job.command.id === "environments.cleanup-run",
    );
    expect(cleanup?.input.params).toEqual({ environmentId: "env", runId: "run", stop: false });
    expect(f.queued.some((job) => typeof job.command !== "string" && job.command.id === "runs.collect")).toBe(false);
    await cleanupEnvironmentCommand.run(f.ctx, cleanup!.input.params as never);
    expect(await activeRun(f.store, "env")).toBeNull();
    expect(f.stops()).toBe(0);
  } finally {
    f.parent.abort();
    await pending.catch(() => {});
  }
});

test.each(["show", "check"])("saved setup result stays visible when %s cleanup admission fails", async (entry) => {
  const f = await fixture(false, -1, true);
  const errors: string[] = [];
  f.ctx.logger.error = (message) => {
    errors.push(message);
  };
  f.ctx.automation.enqueue = async () => {
    throw new Error("Queue unavailable");
  };
  const result =
    entry === "show"
      ? await showRun.run(f.ctx, { runId: "run" })
      : await checkRun(
          {
            store: f.store,
            api: async () => {
              throw new Error("Setup must not poll");
            },
            storage: { download: async () => null },
            saveLog: async () => "unused",
            cleanupEnvironment: async () => {
              throw new Error("Queue unavailable");
            },
          },
          f.record,
        );
  expect(result).toMatchObject({ status: "error", error: "Environment setup expired before request submission." });
  expect(await activeRun(f.store, "env")).toBe("run");
  expect(await f.store.collection("environment-cleanups").get("run:env")).toMatchObject({ stop: false });
  expect(f.reads()).toBe(0);
  expect(f.stops()).toBe(0);
  if (entry === "show") expect(errors[0]).toContain("Queue unavailable");
});

test("explicit show retries a failed first setup cleanup without an assigned schedule", async () => {
  const f = await fixture(false, -1, true);
  const first = await showRun.run(f.ctx, { runId: "run" });
  expect(first).toMatchObject({ status: "error" });
  expect(f.queued).toHaveLength(1);
  const prior = f.jobs.get("job-0")!;
  prior.status = "failed";
  prior.error = { code: "command_failed", message: "Release storage unavailable", retryable: false };
  expect(await showRun.run(f.ctx, { runId: "run" })).toEqual(first);
  expect(f.queued).toHaveLength(2);
  expect(f.queued[1]?.key).toBe("remote-tests:cleanup:run:env:job-0");
  expect(f.queued[1]?.input.params).toEqual({ environmentId: "env", runId: "run", stop: false });
  expect(prior.error).toMatchObject({ retryable: false });
  expect(await activeRun(f.store, "env")).toBe("run");
  await cleanupEnvironmentCommand.run(f.ctx, f.queued[1]!.input.params as never);
  expect(await activeRun(f.store, "env")).toBeNull();
  expect(f.reads()).toBe(0);
  expect(f.stops()).toBe(0);
});
