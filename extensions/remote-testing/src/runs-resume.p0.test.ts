import { expect, test } from "bun:test";
import type { ExtensionAutomationApi } from "@pstdio/sdk/extensions";
import { createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import { startCollection } from "./collection";
import { showRun } from "./commands";
import type { RunRecord } from "./runs";
import { runsView } from "./workbench";

type Job = NonNullable<Awaited<ReturnType<ExtensionAutomationApi["get"]>>>;
const job = (id: string, status: Job["status"]): Job => ({
  id,
  status,
  projectId: "project",
  commandId: "runs.collect",
  createdAt: "2026-01-01T00:00:00Z",
  startedAt: null,
  finishedAt: null,
  result: null,
  error:
    status === "failed"
      ? { code: "host_restarted", message: "The host restarted during command execution.", retryable: true }
      : null,
});

async function fixture(prior: Job["status"] | "missing" | "none", stopAfterRun = true) {
  const store = createMemoryStorage();
  const record: RunRecord = {
    runId: "run",
    environmentId: "env",
    requestId: "request",
    conversationId: "conversation",
    root: "/",
    command: "bun test",
    startedAt: "2026-01-01T00:00:00Z",
    timeoutSeconds: 60,
    stopAfterRun,
  };
  await store.set("run:run", record);
  if (prior !== "none") await store.set("collector:run", "interrupted");
  const jobs = new Map<string, Job>();
  if (prior !== "none" && prior !== "missing") jobs.set("interrupted", job("interrupted", prior));
  const queued: Parameters<ExtensionAutomationApi["enqueue"]>[0][] = [];
  const warnings: string[] = [];
  const ctx = makeCommandContext({
    storage: store,
    projectId: "project",
    params: {},
    overrides: {
      connections: {
        request: async () => {
          throw new Error("The view must not poll the controller");
        },
      },
      settings: { all: async () => ({ templateVersion: "1", storageBucket: "fixture", signerAccount: "fixture" }) },
      automation: {
        get: async (id) => jobs.get(id),
        enqueue: async (input) => {
          queued.push(input);
          const next = job("resumed", "queued");
          jobs.set(next.id, next);
          return next;
        },
      },
      logger: {
        warn(message) {
          warnings.push(message);
        },
      },
    },
  });
  return { ctx, store, record, queued, jobs, warnings };
}

test.each([
  "failed",
  "cancelled",
  "missing",
  "none",
] as const)("opening unfinished runs resumes a %s collector", async (prior) => {
  const f = await fixture(prior, prior !== "cancelled");
  const table = await runsView.body.query(f.ctx);
  expect(table.rows[0]?.values.status).toBe("running");
  expect(f.queued).toHaveLength(1);
  expect(f.queued[0]).toMatchObject({ command: { id: "runs.collect" }, input: { params: { runId: "run" } } });
  expect(await f.store.collection<{ jobId: string }>("run-collectors").get("run")).toEqual({ jobId: "resumed" });
  await runsView.body.query(f.ctx);
  expect(f.queued).toHaveLength(1);
});

test.each([
  "queued",
  "running",
  "succeeded",
] as const)("opening runs preserves an existing %s collector", async (prior) => {
  const f = await fixture(prior);
  await runsView.body.query(f.ctx);
  expect(f.queued).toHaveLength(0);
});

test("opening completed runs does not restart their failed collector", async () => {
  const f = await fixture("failed");
  await f.store.set("run:run", {
    ...f.record,
    summary: {
      runId: "run",
      environmentId: "env",
      status: "passed",
      exitCode: 0,
      durationMs: 10,
      logPath: "run.log",
      tail: "done",
    },
  });
  const table = await runsView.body.query(f.ctx);
  expect(table.rows[0]?.values.status).toBe("passed");
  expect(f.queued).toHaveLength(0);
});

test("failed recovery keeps saved run rows readable and reports the run", async () => {
  const f = await fixture("failed");
  f.ctx.automation.enqueue = async () => {
    throw new Error("Queue unavailable");
  };
  const table = await runsView.body.query(f.ctx);
  expect(table.rows[0]?.id).toBe("run");
  expect(f.warnings).toHaveLength(1);
  expect(f.warnings[0]).toContain("run");
  expect(f.warnings[0]).toContain("Queue unavailable");
});

test("view refresh leaves permanent collection failures for explicit retry", async () => {
  const f = await fixture("failed");
  f.jobs.set("interrupted", {
    ...job("interrupted", "failed"),
    error: { code: "command_failed", message: "Fix configuration", retryable: false },
  });
  await runsView.body.query(f.ctx);
  expect(f.queued).toHaveLength(0);
});

test("an explicit wait can retry a permanent collector failure", async () => {
  const f = await fixture("failed");
  f.jobs.set("interrupted", {
    ...job("interrupted", "failed"),
    error: { code: "command_failed", message: "Fix configuration", retryable: false },
  });
  const summary = {
    runId: "run",
    environmentId: "env",
    status: "passed" as const,
    exitCode: 0,
    durationMs: 10,
    logPath: "run.log",
    tail: "done",
  };
  const enqueue = f.ctx.automation.enqueue;
  f.ctx.automation.enqueue = async (input) => {
    const next = await enqueue(input);
    await f.store.set("run:run", { ...f.record, summary });
    f.jobs.set(next.id, { ...next, status: "succeeded" });
    return next;
  };
  expect(await showRun.run(f.ctx, { runId: "run" })).toEqual(summary);
  expect(f.queued).toHaveLength(1);
});

test("legacy runs retain one-shot collection instead of getting a new worker", async () => {
  const f = await fixture("none");
  const { stopAfterRun: _, ...legacy } = f.record;
  await f.store.set("run:run", legacy);
  const table = await runsView.body.query(f.ctx);
  expect(table.rows[0]?.id).toBe("run");
  expect(f.queued).toHaveLength(0);
});

test("provider configuration failure does not hide saved runs or prevent worker recovery", async () => {
  const f = await fixture("failed");
  f.ctx.settings.all = async () => {
    throw new Error("Settings temporarily unavailable");
  };
  const table = await runsView.body.query(f.ctx);
  expect(table.rows[0]?.id).toBe("run");
  expect(f.queued).toHaveLength(1);
});

test("opening a run advances an interrupted first admission whose saved link was lost", async () => {
  const f = await fixture("none");
  const existing = job("persisted-first", "failed");
  f.jobs.set(existing.id, existing);
  const enqueue = f.ctx.automation.enqueue;
  f.ctx.automation.enqueue = async (input) => {
    if (input.key.endsWith(":first")) {
      f.queued.push(input);
      return existing;
    }
    return enqueue(input);
  };
  await runsView.body.query(f.ctx);
  expect(f.queued).toHaveLength(2);
  expect(f.queued[1]?.key).toBe("remote-tests:collect:run:persisted-first");
  await runsView.body.query(f.ctx);
  expect(f.queued).toHaveLength(2);
});

test("a late query cannot replace a newer collector generation", async () => {
  const f = await fixture("failed");
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const byKey = new Map<string, Job>();
  let delayed = false;
  f.ctx.automation.enqueue = async (input) => {
    f.queued.push(input);
    let next = byKey.get(input.key);
    if (!next) {
      next = job(`generation-${byKey.size + 1}`, "queued");
      byKey.set(input.key, next);
      f.jobs.set(next.id, next);
    }
    if (!delayed) {
      delayed = true;
      entered.resolve();
      await release.promise;
    }
    return next;
  };
  const stale = runsView.body.query(f.ctx);
  try {
    await entered.promise;
    await runsView.body.query(f.ctx);
    f.jobs.set("generation-1", {
      ...job("generation-1", "failed"),
      error: { code: "command_failed", message: "Fix configuration", retryable: false },
    });
    await startCollection(f.ctx, "run");
    release.resolve();
    await stale;
    f.jobs.set("generation-2", job("generation-2", "failed"));
    await runsView.body.query(f.ctx);
    expect(byKey.size).toBe(3);
    expect(f.jobs.get("generation-3")?.status).toBe("queued");
  } finally {
    release.resolve();
    await stale;
  }
});

test.each([
  "failed",
  "rejected",
] as const)("an explicit wait advances an unlinked %s admission replay", async (status) => {
  const f = await fixture("none");
  const existing = {
    ...job("persisted-first", status),
    error: { code: "command_failed", message: "Fix configuration", retryable: false },
  };
  f.jobs.set(existing.id, existing);
  const enqueue = f.ctx.automation.enqueue;
  f.ctx.automation.enqueue = async (input) => {
    if (input.key.endsWith(":first")) {
      f.queued.push(input);
      return existing;
    }
    return enqueue(input);
  };
  expect(await startCollection(f.ctx, "run")).toBe("resumed");
  expect(f.queued).toHaveLength(2);
  expect(f.queued[1]?.key).toBe("remote-tests:collect:run:persisted-first");
});

test("automatic recovery does not advance a permanent unlinked replay", async () => {
  const f = await fixture("none");
  const existing = {
    ...job("persisted-first", "failed"),
    error: { code: "command_failed", message: "Fix configuration", retryable: false },
  };
  f.jobs.set(existing.id, existing);
  f.ctx.automation.enqueue = async (input) => {
    f.queued.push(input);
    return existing;
  };
  await runsView.body.query(f.ctx);
  expect(f.queued).toHaveLength(1);
  await runsView.body.query(f.ctx);
  expect(f.queued).toHaveLength(1);
});
