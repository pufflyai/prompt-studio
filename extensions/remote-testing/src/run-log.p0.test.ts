import { expect, test } from "bun:test";
import type { ExtensionAutomationApi } from "@pstdio/sdk/extensions";
import { createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import { collectSavedRunLog, enqueueRunLog, resumeRunLogs } from "./run-log";
import type { RunRecord } from "./runs";

async function fixture() {
  const store = createMemoryStorage();
  const record: RunRecord = {
    runId: "run",
    environmentId: "env",
    requestId: "request",
    conversationId: "conversation",
    root: "/",
    command: "bun test",
    startedAt: new Date().toISOString(),
    timeoutSeconds: 60,
    stopAfterRun: true,
    summary: {
      runId: "run",
      environmentId: "env",
      status: "timed_out",
      exitCode: null,
      durationMs: 60000,
      logPath: null,
      tail: "",
      error: "retained diagnostic",
    },
  };
  await store.set("run:run", record);
  const queued: Parameters<ExtensionAutomationApi["enqueue"]>[0][] = [];
  type Job = NonNullable<Awaited<ReturnType<ExtensionAutomationApi["get"]>>>;
  const jobs = new Map<string, Job>();
  const ctx = makeCommandContext({
    storage: store,
    params: {},
    overrides: {
      automation: {
        get: async (id) => jobs.get(id),
        enqueue: async (input) => {
          queued.push(input);
          const id = `job-${jobs.size}`;
          const job: Job = {
            id,
            projectId: "project",
            commandId: "runs.collect-log",
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
  return { store, record, ctx, queued, jobs };
}

test("a timeout log is backfilled after cleanup without changing the saved outcome", async () => {
  const f = await fixture();
  await enqueueRunLog(f.ctx, "run");
  expect(f.queued).toHaveLength(1);
  expect(f.queued[0]?.command).toMatchObject({ id: "runs.collect-log" });
  await collectSavedRunLog(
    {
      store: f.store,
      api: async () => {
        throw new Error("Receipt and workspace are unavailable");
      },
      storage: { download: async () => new TextEncoder().encode("test reached timeout\nfull diagnostic") },
      saveLog: async () => "run.log",
    },
    "run",
  );
  expect(await f.store.get("run:run")).toMatchObject({
    summary: {
      ...f.record.summary,
      logPath: "run.log",
      tail: "test reached timeout\nfull diagnostic",
    },
  });
  expect(await f.store.collection("pending-run-logs").get("run")).toBeUndefined();
});

test("interrupted log collection resumes without depending on workspace ownership", async () => {
  const f = await fixture();
  await enqueueRunLog(f.ctx, "run");
  const job = f.jobs.get("job-0")!;
  job.status = "failed";
  job.error = { code: "host_restarted", message: "Host restarted", retryable: true };
  await resumeRunLogs(f.ctx);
  expect(f.queued).toHaveLength(2);
  expect(f.queued[1]?.key).toBe("remote-tests:log:run:job-0");
  expect((await f.store.get<RunRecord>("run:run"))?.summary).toEqual(f.record.summary);
});

test("an unavailable log download preserves both the timeout and recovery intent", async () => {
  const f = await fixture();
  await enqueueRunLog(f.ctx, "run");
  const failure = new Error("Log unavailable");
  await expect(
    collectSavedRunLog(
      {
        store: f.store,
        api: async () => {
          throw new Error("No workspace access");
        },
        storage: {
          download: async () => {
            throw failure;
          },
        },
        saveLog: async () => "run.log",
      },
      "run",
    ),
  ).rejects.toBe(failure);
  expect((await f.store.get<RunRecord>("run:run"))?.summary).toEqual(f.record.summary);
  expect(await f.store.collection("pending-run-logs").get("run")).toMatchObject({ runId: "run" });
});

test("a late uploaded timeout log survives an initial missing-object response", async () => {
  const f = await fixture();
  await f.store.collection("pending-run-logs").put("run", { runId: "run", missingUntil: Date.now() + 30_000 });
  let downloads = 0;
  await collectSavedRunLog(
    {
      store: f.store,
      api: async () => {
        throw new Error("No workspace access");
      },
      storage: { download: async () => (++downloads === 1 ? null : new TextEncoder().encode("late uploaded log")) },
      saveLog: async () => "run.log",
    },
    "run",
  );
  expect((await f.store.get<RunRecord>("run:run"))?.summary).toMatchObject({
    status: "timed_out",
    durationMs: 60000,
    logPath: "run.log",
    tail: "late uploaded log",
  });
});

test("expired missing-log recovery makes one final read and retains the timeout", async () => {
  const f = await fixture();
  await f.store.collection("pending-run-logs").put("run", { runId: "run", missingUntil: Date.now() - 1 });
  let downloads = 0;
  await collectSavedRunLog(
    {
      store: f.store,
      api: async () => {
        throw new Error("No workspace access");
      },
      storage: {
        download: async () => {
          downloads++;
          return null;
        },
      },
      saveLog: async () => "unused",
    },
    "run",
  );
  expect(downloads).toBe(1);
  expect(await f.store.collection("pending-run-logs").get("run")).toBeUndefined();
  expect((await f.store.get<RunRecord>("run:run"))?.summary).toEqual(f.record.summary);
});
