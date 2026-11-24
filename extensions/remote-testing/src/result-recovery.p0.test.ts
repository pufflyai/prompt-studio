import { expect, test } from "bun:test";
import type { ExtensionAutomationApi } from "@pstdio/sdk/extensions";
import { makeCommandContext } from "@pstdio/sdk/testing";
import { collectRun } from "./collection";
import { recoverEnvironmentCleanup } from "./environment-cleanup";
import { activeRun, claimEnvironment } from "./environments";
import { createRunStorage } from "./run-storage-fixture";
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
