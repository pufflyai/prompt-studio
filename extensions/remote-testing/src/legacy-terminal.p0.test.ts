import { expect, test } from "bun:test";
import type { ExtensionAutomationApi } from "@pstdio/sdk/extensions";
import { makeCommandContext } from "@pstdio/sdk/testing";
import {
  cleanupEnvironmentCommand,
  recoverEnvironmentCleanup,
  rememberEnvironmentCleanup,
} from "./environment-cleanup";
import { activeRun, type Claim, claimEnvironment } from "./environments";
import { createRunStorage } from "./run-storage-fixture";
import type { RunRecord, RunSummary } from "./runs";

async function fixture(status: RunSummary["status"] = "passed") {
  const store = createRunStorage();
  const record: RunRecord = {
    runId: "old",
    environmentId: "env",
    requestId: "request",
    conversationId: "conversation",
    root: "/",
    command: "bun test",
    startedAt: new Date().toISOString(),
    timeoutSeconds: 60,
    stopAfterRun: false,
    summary: {
      runId: "old",
      environmentId: "env",
      status,
      exitCode: status === "passed" ? 0 : null,
      durationMs: 17,
      logPath: null,
      tail: "saved output",
    },
  };
  await store.set("run:old", record);
  await store.collection<Claim>("environment-claims").put("env", { runId: "old", until: Date.now() - 1 });
  const queued: Parameters<ExtensionAutomationApi["enqueue"]>[0][] = [];
  const requests: string[] = [];
  const ctx = makeCommandContext({
    storage: store,
    params: {},
    overrides: {
      connections: {
        request: async <T>(_id: string, input: { method: string; path: string }) => {
          requests.push(`${input.method} ${input.path}`);
          return { status: 200, headers: {}, body: { id: "env", state: "ready" } as T };
        },
      },
      automation: {
        enqueue: async (input) => {
          queued.push(input);
          return {
            id: `job-${queued.length}`,
            projectId: "project",
            commandId: "environments.cleanup-run",
            status: "queued",
            createdAt: new Date().toISOString(),
            startedAt: null,
            finishedAt: null,
            error: null,
            result: null,
          };
        },
      },
    },
  });
  return { store, record, ctx, queued, requests };
}

test.each([
  "passed",
  "failed",
  "canceled",
  "timed_out",
] as const)("recovery releases an exact expired legacy terminal claim without stopping a kept workspace (%s)", async (status) => {
  const f = await fixture(status);
  await recoverEnvironmentCleanup.run(f.ctx, {});
  expect(await activeRun(f.store, "env")).toBeNull();
  expect(await claimEnvironment(f.store, "env", "replacement")).toBe(true);
  expect(f.requests).toEqual([]);
  expect(f.queued).toEqual([]);
  expect((await f.store.get<RunRecord>("run:old"))?.summary).toEqual(f.record.summary);
});

// Immutable pre-upgrade collector 739a3aa saves these only after a finalized
// receipt and successful log persistence. Its launch-error path has no logPath.
const loggedLegacyErrors = [
  { kind: "runner marker error", error: "Runner failed", durationMs: 37 },
  { kind: "controller response without marker", error: "Controller failed", durationMs: 43 },
  { kind: "missing response outcome", error: "null", durationMs: 47 },
];

test.each(loggedLegacyErrors)("recovery releases a kept legacy finalized error with a saved log ($kind)", async ({
  error,
  durationMs,
}) => {
  const f = await fixture("error");
  const summary = { ...f.record.summary!, error, durationMs, logPath: "runs/old.log", tail: "retained error log" };
  await f.store.set("run:old", { ...f.record, summary });
  await recoverEnvironmentCleanup.run(f.ctx, {});
  expect(await activeRun(f.store, "env")).toBeNull();
  expect(await claimEnvironment(f.store, "env", "replacement")).toBe(true);
  expect(f.requests).toEqual([]);
  expect(f.queued).toEqual([]);
  expect((await f.store.get<RunRecord>("run:old"))?.summary).toEqual(summary);
});

test.each([
  "identity mismatch",
  "live setup",
  "pending admission",
  "synthetic timeout",
])("a saved log cannot bypass the legacy safety fence (%s)", async (kind) => {
  const f = await fixture("error");
  const record: RunRecord = {
    ...f.record,
    summary: { ...f.record.summary!, error: "Runner failed", logPath: "runs/old.log" },
  };
  if (kind === "identity mismatch") record.summary!.environmentId = "another-environment";
  if (kind === "live setup")
    await f.store.collection<Claim>("environment-claims").put("env", {
      runId: "old",
      until: Date.now() - 1,
      setup: { until: Date.now() + 3600_000, stop: false, environmentId: "env" },
    });
  if (kind === "pending admission") record.submissionPending = true;
  if (kind === "synthetic timeout") record.summary!.status = "timed_out";
  await f.store.set("run:old", record);
  await recoverEnvironmentCleanup.run(f.ctx, {});
  expect(await activeRun(f.store, "env")).toBe("old");
  expect(await claimEnvironment(f.store, "env", "replacement")).toBe(false);
  expect(f.requests).toEqual([]);
  expect(f.queued).toEqual([]);
});

test.each([
  "existing stop intent",
  "stop after run",
])("legacy terminal recovery preserves cleanup (%s)", async (kind) => {
  const f = await fixture();
  if (kind === "existing stop intent")
    await rememberEnvironmentCleanup(f.store, { environmentId: "env", runId: "old", stop: true });
  else await f.store.set("run:old", { ...f.record, stopAfterRun: true });
  await recoverEnvironmentCleanup.run(f.ctx, {});
  expect(await activeRun(f.store, "env")).toBe("old");
  expect(await claimEnvironment(f.store, "env", "replacement")).toBe(false);
  expect(f.queued).toHaveLength(1);
  expect(f.queued[0]?.input.params).toEqual({ environmentId: "env", runId: "old", stop: true });
  await cleanupEnvironmentCommand.run(f.ctx, f.queued[0]!.input.params as never);
  expect(f.requests).toEqual(["GET /v1/workspaces/env", "POST /v1/workspaces/env/cancel"]);
  expect(await activeRun(f.store, "env")).toBeNull();
});

test.each([
  "live",
  "wrong run",
  "wrong environment",
  "wrong summary run",
  "wrong summary environment",
  "pending result",
  "pending admission",
  "unexpired",
  "setup",
  "error",
  "unconfirmed timeout",
])("legacy terminal recovery fences work without exact final proof (%s)", async (kind) => {
  const f = await fixture();
  const record: RunRecord = { ...f.record, summary: { ...f.record.summary! } };
  const claim: Claim = { runId: "old", until: Date.now() - 1 };
  if (kind === "live") delete record.summary;
  if (kind === "wrong run") record.runId = "different";
  if (kind === "wrong environment") record.environmentId = "different";
  if (kind === "wrong summary run") record.summary!.runId = "different";
  if (kind === "wrong summary environment") record.summary!.environmentId = "different";
  if (kind === "pending result") record.pendingResult = { id: "checkpoint", summary: record.summary!, release: false };
  if (kind === "pending admission") record.submissionPending = true;
  if (kind === "unexpired") claim.until = Date.now() + 3600_000;
  if (kind === "setup") claim.setup = { until: Date.now() + 3600_000, stop: false, environmentId: "env" };
  if (kind === "error") record.summary!.status = "error";
  if (kind === "unconfirmed timeout") {
    record.summary!.status = "timed_out";
    record.summary!.error = "No final receipt";
  }
  await f.store.set("run:old", record);
  await f.store.collection<Claim>("environment-claims").put("env", claim);
  // Inspect the legacy reconciliation through the public sweep, while keeping
  // existing collector/checkpoint recovery from advancing unrelated work.
  f.ctx.automation.enqueue = async () => {
    throw new Error("No admission in this fence fixture");
  };
  await recoverEnvironmentCleanup.run(f.ctx, {});
  expect(await activeRun(f.store, "env")).toBe("old");
  expect(await claimEnvironment(f.store, "env", "replacement")).toBe(false);
  expect(f.requests).toEqual([]);
});

test.each([
  "passed",
  "error",
] as const)("legacy terminal release preserves a replaced live setup (%s)", async (status) => {
  const f = await fixture(status);
  if (status === "error")
    await f.store.set("run:old", {
      ...f.record,
      summary: { ...f.record.summary!, error: "Runner failed", logPath: "runs/old.log" },
    });
  const collection = f.store.collection.bind(f.store);
  let raced = false;
  const replacement: Claim = {
    runId: "old",
    until: Number.MAX_SAFE_INTEGER,
    setup: { until: Date.now() + 3600_000, stop: false, environmentId: "env" },
  };
  f.store.collection = <T>(name: string) => {
    const current = collection<T>(name);
    return {
      ...current,
      deleteIfValue: async (id: string, value: T) => {
        if (!raced && name === "environment-claims") {
          raced = true;
          await collection<Claim>(name).put(id, replacement);
        }
        return current.deleteIfValue(id, value);
      },
    };
  };
  await recoverEnvironmentCleanup.run(f.ctx, {});
  expect(raced).toBe(true);
  expect(await f.store.collection<Claim>("environment-claims").get("env")).toEqual(replacement);
  expect(await claimEnvironment(f.store, "env", "replacement")).toBe(false);
  expect(f.requests).toEqual([]);
  expect(f.queued).toEqual([]);
});
