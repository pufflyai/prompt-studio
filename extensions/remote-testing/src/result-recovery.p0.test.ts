import { expect, test } from "bun:test";
import type { ExtensionAutomationApi } from "@pstdio/sdk/extensions";
import { makeCommandContext } from "@pstdio/sdk/testing";
import { collectRun } from "./collection";
import { recoverEnvironmentCleanup } from "./environment-cleanup";
import { activeRun, claimEnvironment } from "./environments";
import { persistResult } from "./result-persistence";
import { createRunStorage } from "./run-storage-fixture";
import { saveTimedOutRun } from "./run-timeout";
import { checkRun, type RunRecord } from "./runs";

test.each([
  { code: "command_failed", linked: true, timedOut: false, clearFailure: false },
  { code: "command_execution_failed", linked: true, timedOut: true, clearFailure: false },
  { code: "command_failed", linked: false, timedOut: false, clearFailure: false },
  { code: "command_execution_failed", linked: true, timedOut: false, clearFailure: true },
])("scheduled recovery completes a non-retryable result-write failure (%j)", async ({
  code,
  linked,
  timedOut,
  clearFailure,
}) => {
  const store = createRunStorage();
  const record: RunRecord = {
    runId: "run",
    environmentId: "env",
    requestId: "request",
    conversationId: "conversation",
    command: "bun test",
    root: "/",
    startedAt: new Date().toISOString(),
    timeoutSeconds: 60,
    stopAfterRun: false,
  };
  await store.set("run:run", record);
  await claimEnvironment(store, "env", "run");
  const set = store.set;
  const commit = store.records.commitIfCurrent;
  let unavailable = true;
  store.set = async (key, value) => {
    if (unavailable && !clearFailure && key === "run:run" && (value as RunRecord).summary)
      throw new Error("Result storage unavailable");
    return set(key, value);
  };
  store.records.commitIfCurrent = async (group) => {
    if (
      unavailable &&
      group.edits.some((edit) => (clearFailure ? edit.unset?.includes("/pendingResult") : edit.set?.["/summary"]))
    )
      throw new Error("Result storage unavailable");
    return commit(group);
  };
  let receiptReads = 0;
  const logFiles = new Map<string, string>();
  await expect(
    checkRun(
      {
        store,
        api: async () => {
          receiptReads++;
          return {
            finalizedAt: new Date().toISOString(),
            acceptance: { execution: {} },
            outcome: {
              finalResponse:
                "REMOTE_TEST_RESULT " +
                JSON.stringify({ exitCode: timedOut ? null : 0, durationMs: timedOut ? 60000 : 17, timedOut }),
            },
          } as never;
        },
        storage: { download: async () => new TextEncoder().encode("actual test log") },
        saveLog: async (id, text) => {
          logFiles.set(`runs/${id}.log`, text);
          return "run.log";
        },
      },
      record,
    ),
  ).rejects.toThrow("Result storage unavailable");
  type Job = NonNullable<Awaited<ReturnType<ExtensionAutomationApi["get"]>>>;
  const failed: Job = {
    id: "failed",
    projectId: "project",
    commandId: "runs.collect",
    status: "failed",
    createdAt: new Date().toISOString(),
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    result: null,
    error: { code, message: "Result storage unavailable", retryable: false },
  };
  const jobs = new Map<string, Job>([[failed.id, failed]]);
  if (linked) await store.collection("run-collectors").put("run", { jobId: failed.id });
  unavailable = false;
  if (clearFailure)
    await store.records.commit({
      operationId: crypto.randomUUID(),
      edits: [
        {
          recordId: store.records.id("run:run"),
          set: { "/summary/logPath": "enriched.log", "/summary/tail": "later diagnostic" },
        },
      ],
    });
  const queued: Parameters<ExtensionAutomationApi["enqueue"]>[0][] = [];
  const ctx = makeCommandContext({
    storage: store,
    params: {},
    overrides: {
      extensionFiles: {
        readText: async (path) => {
          const text = logFiles.get(path);
          if (text === undefined) throw new Error("Saved log missing");
          return text;
        },
      },
      automation: {
        get: async (id) => jobs.get(id),
        enqueue: async (input) => {
          queued.push(input);
          if (!linked && input.key === "remote-tests:collect:run:first") return failed;
          const next: Job = { ...failed, id: "recovered", status: "queued", error: null };
          jobs.set(next.id, next);
          return next;
        },
      },
    },
  });
  await recoverEnvironmentCleanup.run(ctx, {});
  expect(queued.map((job) => job.key)).toEqual(
    linked
      ? ["remote-tests:collect:run:failed"]
      : ["remote-tests:collect:run:first", "remote-tests:collect:run:failed"],
  );
  expect(await store.collection("run-collectors").get("run")).toEqual({ jobId: "recovered" });
  await collectRun.run(ctx, { runId: "run" });
  const baseLog = timedOut ? { logPath: null, tail: "" } : { logPath: "run.log", tail: "actual test log" };
  const expectedLog = clearFailure ? { logPath: "enriched.log", tail: "later diagnostic" } : baseLog;
  expect((await store.get<RunRecord>("run:run"))?.summary).toMatchObject({
    status: timedOut ? "timed_out" : "passed",
    exitCode: timedOut ? null : 0,
    durationMs: timedOut ? 60000 : 17,
    ...expectedLog,
  });
  expect((await store.get<RunRecord>("run:run"))?.pendingResult).toBeUndefined();
  expect(receiptReads).toBe(1);
  expect(await activeRun(store, "env")).toBeNull();
});

test.each([
  "read",
  "write",
])("a temporary pre-checkpoint %s failure retains ownership and retries local storage", async (failure) => {
  const store = createRunStorage();
  const record: RunRecord = {
    runId: "run",
    environmentId: "env",
    requestId: "request",
    conversationId: "conversation",
    root: "/",
    command: "bun test",
    startedAt: new Date().toISOString(),
    timeoutSeconds: 60,
    stopAfterRun: false,
  };
  await store.set("run:run", record);
  await claimEnvironment(store, "env", "run");
  const read = store.records.read;
  const commit = store.records.commitIfCurrent;
  let failed = false;
  const failOnce = async () => {
    expect(await activeRun(store, "env")).toBe("run");
    failed = true;
    throw new Error("Checkpoint storage temporarily unavailable");
  };
  store.records.read = async (id) => {
    if (failure === "read" && !failed) await failOnce();
    return read(id);
  };
  store.records.commitIfCurrent = async (group) => {
    if (failure === "write" && !failed) await failOnce();
    return commit(group);
  };
  const summary = {
    runId: "run",
    environmentId: "env",
    status: "passed" as const,
    exitCode: 0,
    durationMs: 17,
    logPath: null,
    tail: "",
  };
  await expect(persistResult({ store }, record, summary, true)).resolves.toEqual(summary);
  expect(failed).toBe(true);
  expect(await activeRun(store, "env")).toBeNull();
  expect((await store.get<RunRecord>("run:run"))?.pendingResult).toBeUndefined();
});

test.each([
  "environment-cleanups",
  "pending-run-logs",
])("timeout preparation retries a temporary %s write without losing its result", async (failure) => {
  const store = createRunStorage();
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
  };
  await store.set("run:run", record);
  await claimEnvironment(store, "env", "run");
  const collection = store.collection.bind(store);
  let failed = false;
  store.collection = <T>(name: string) => {
    const current = collection<T>(name);
    return {
      ...current,
      createIfAbsent: async (id: string, value: T) => {
        if (name === failure && !failed) {
          failed = true;
          throw new Error("Intent storage temporarily unavailable");
        }
        return current.createIfAbsent(id, value);
      },
    };
  };
  const summary = {
    runId: "run",
    environmentId: "env",
    status: "timed_out" as const,
    exitCode: null,
    durationMs: 60000,
    logPath: null,
    tail: "",
  };
  await expect(
    saveTimedOutRun(
      {
        store,
        api: async () => {
          throw new Error("No remote request expected");
        },
        storage: { download: async () => null },
        saveLog: async () => "unused",
      },
      record,
      summary,
      true,
      true,
    ),
  ).resolves.toEqual(summary);
  expect(failed).toBe(true);
  expect(await activeRun(store, "env")).toBe("run");
  expect(await store.collection("environment-cleanups").get("run:env")).toMatchObject({ runId: "run", stop: true });
  expect(await store.collection("pending-run-logs").get("run")).toMatchObject({ runId: "run" });
  expect((await store.get<RunRecord>("run:run"))?.summary).toEqual(summary);
});
