import { expect, spyOn, test } from "bun:test";
import { makeCommandContext } from "@pstdio/sdk/testing";
import { collectRun } from "./collection";
import { recoverEnvironmentCleanup } from "./environment-cleanup";
import { activeRun, claimEnvironment } from "./environments";
import { collectRunLog, rememberRunLog } from "./run-log";
import { createRunStorage } from "./run-storage-fixture";
import type { RunRecord } from "./runs";

const fetchTarget: { fetch: (...args: Parameters<typeof fetch>) => ReturnType<typeof fetch> } = globalThis;

async function fixture(status: "error" | "timed_out" = "error") {
  const store = createRunStorage();
  const record: RunRecord = {
    runId: "old",
    environmentId: "env",
    requestId: "accepted-request",
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
      exitCode: null,
      durationMs: 17,
      logPath: null,
      tail: "",
      error: status === "error" ? "Accepted POST reply was lost" : "No finalized receipt before deadline",
    },
  };
  await store.set("run:old", record);
  // Exact old launcher shape: a finite lease, no submissionPending/checkpoint,
  // and an error whose accepted execution can still be live after log upload.
  await store.collection("environment-claims").put("env", { runId: "old", until: Date.now() - 1 });
  const requests: string[] = [];
  const admissions: string[] = [];
  const savedLogs = new Map<string, string>();
  const ctx = makeCommandContext({
    storage: store,
    params: {},
    overrides: {
      settings: { all: async () => ({ templateVersion: "1", storageBucket: "fixture", signerAccount: "fixture" }) },
      connections: {
        request: async <T>(_id: string, input: { method: string; path: string }) => {
          requests.push(`${input.method} ${input.path}`);
          return {
            status: 200,
            headers: {},
            body: { finalizedAt: null, phase: "running", acceptance: { execution: {} } } as T,
          };
        },
      },
      process: { run: async () => ({ exitCode: 0, stdout: "fixture-token", stderr: "" }) },
      extensionFiles: {
        writeText: async (path, text) => {
          savedLogs.set(path, text);
        },
      },
      automation: {
        enqueue: async (input) => {
          admissions.push(typeof input.command === "string" ? input.command : input.command.id);
          return {
            id: `job-${admissions.length}`,
            projectId: "project",
            commandId: "runs.collect-log",
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
  return { store, record, ctx, requests, admissions, savedLogs };
}

test("public log backfill cannot turn an old lost-reply error into terminal claim proof", async () => {
  const f = await fixture();
  let downloads = 0;
  const download = spyOn(fetchTarget, "fetch").mockImplementation(async () => {
    downloads++;
    return new Response("uploaded log while accepted execution remains running");
  });
  try {
    let commandError: unknown;
    try {
      await collectRunLog.run(f.ctx, { runId: "old" });
    } catch (error) {
      commandError = error;
    }
    await recoverEnvironmentCleanup.run(f.ctx, {});
    expect(await activeRun(f.store, "env")).toBe("old");
    expect(await claimEnvironment(f.store, "env", "competitor")).toBe(false);
    expect((await f.store.get<RunRecord>("run:old"))?.summary).toEqual(f.record.summary);
    expect(downloads).toBe(0);
    expect(f.savedLogs.size).toBe(0);
    expect(f.requests).toEqual([]);
    expect(f.admissions).toEqual([]);
    expect(commandError).toBeInstanceOf(Error);
    expect(await f.store.collection("pending-run-logs").get("old")).toBeUndefined();
  } finally {
    download.mockRestore();
  }
});

test.each([
  "error",
  "passed",
] as const)("public backfill rechecks a collector result changed during download (%s)", async (status) => {
  const f = await fixture("timed_out");
  await rememberRunLog(f.store, "old");
  const replacement = {
    ...f.record.summary!,
    status,
    error: status === "error" ? "Accepted POST reply was lost" : undefined,
  };
  let downloads = 0;
  const download = spyOn(fetchTarget, "fetch").mockImplementation(async () => {
    downloads++;
    await f.store.set("run:old", { ...f.record, summary: replacement });
    return new Response("stale timeout log");
  });
  try {
    await collectRunLog.run(f.ctx, { runId: "old" });
    expect((await f.store.get<RunRecord>("run:old"))?.summary).toEqual(replacement);
    expect(downloads).toBe(1);
    expect(f.requests).toEqual([]);
    expect(await f.store.collection("pending-run-logs").get("old")).toBeUndefined();
    if (status === "error") {
      await recoverEnvironmentCleanup.run(f.ctx, {});
      expect(await activeRun(f.store, "env")).toBe("old");
      expect(await claimEnvironment(f.store, "env", "competitor")).toBe(false);
    }
  } finally {
    download.mockRestore();
  }
});

test("public backfill rechecks eligibility after a collector wins the summary CAS", async () => {
  const f = await fixture("timed_out");
  await rememberRunLog(f.store, "old");
  const replacement = { ...f.record.summary!, status: "error" as const, error: "Accepted POST reply was lost" };
  const commit = f.store.records.commitIfCurrent;
  let conflicts = 0;
  f.store.records.commitIfCurrent = async (group) => {
    if (!conflicts && group.edits.some((edit) => edit.set?.["/summary/logPath"])) {
      conflicts++;
      await f.store.set("run:old", { ...f.record, summary: replacement });
    }
    return commit(group);
  };
  const download = spyOn(fetchTarget, "fetch").mockImplementation(async () => new Response("stale timeout log"));
  try {
    await collectRunLog.run(f.ctx, { runId: "old" });
    await recoverEnvironmentCleanup.run(f.ctx, {});
    expect(conflicts).toBe(1);
    expect((await f.store.get<RunRecord>("run:old"))?.summary).toEqual(replacement);
    expect(await activeRun(f.store, "env")).toBe("old");
    expect(await claimEnvironment(f.store, "env", "competitor")).toBe(false);
    expect(f.requests).toEqual([]);
  } finally {
    download.mockRestore();
  }
});

test("public timeout backfill preserves its diagnostic and claim while enriching the saved result", async () => {
  const f = await fixture("timed_out");
  await rememberRunLog(f.store, "old");
  const download = spyOn(fetchTarget, "fetch").mockImplementation(
    async () => new Response("actual timeout diagnostic"),
  );
  try {
    await collectRunLog.run(f.ctx, { runId: "old" });
    await recoverEnvironmentCleanup.run(f.ctx, {});
    expect((await f.store.get<RunRecord>("run:old"))?.summary).toMatchObject({
      ...f.record.summary,
      logPath: expect.stringContaining("runs/old.log"),
      tail: "actual timeout diagnostic",
    });
    expect(await activeRun(f.store, "env")).toBe("old");
    expect(f.requests).toEqual([]);
    expect(await f.store.collection("pending-run-logs").get("old")).toBeUndefined();
  } finally {
    download.mockRestore();
  }
});

test("recovery retires a timeout-log intent superseded by an ambiguous launch error without admission", async () => {
  const f = await fixture();
  await f.store.collection("pending-run-logs").put("old", { runId: "old", jobId: "failed-log-worker" });
  await recoverEnvironmentCleanup.run(f.ctx, {});
  expect(f.admissions).toEqual([]);
  expect(f.requests).toEqual([]);
  expect((await f.store.get<RunRecord>("run:old"))?.summary).toEqual(f.record.summary);
  expect(await activeRun(f.store, "env")).toBe("old");
  expect(await f.store.collection("pending-run-logs").get("old")).toBeUndefined();
});

test("the public finalized collector still saves an actual error log and releases its kept claim", async () => {
  const f = await fixture();
  const { summary: _summary, ...record } = f.record;
  await f.store.set("run:old", record);
  await f.store.collection("environment-claims").put("env", { runId: "old", until: Number.MAX_SAFE_INTEGER });
  f.ctx.connections.request = async <T>(_id: string, input: { method: string; path: string }) => {
    f.requests.push(`${input.method} ${input.path}`);
    return {
      status: 200,
      headers: {},
      body: {
        finalizedAt: new Date().toISOString(),
        acceptance: { execution: {} },
        outcome: {
          status: "completed",
          finalResponse:
            'REMOTE_TEST_RESULT {"exitCode":null,"durationMs":37,"timedOut":false,"error":"Runner failed"}',
        },
      } as T,
    };
  };
  const download = spyOn(fetchTarget, "fetch").mockImplementation(
    async () => new Response("actual finalized error log"),
  );
  try {
    await collectRun.run(f.ctx, { runId: "old" });
    expect((await f.store.get<RunRecord>("run:old"))?.summary).toMatchObject({
      status: "error",
      error: "Runner failed",
      durationMs: 37,
      logPath: expect.stringContaining("runs/old.log"),
      tail: "actual finalized error log",
    });
    expect(await activeRun(f.store, "env")).toBeNull();
    expect(f.requests).toHaveLength(1);
    expect(f.requests[0]).toContain("GET /v1/workspaces/env/requests/accepted-request");
    expect(f.savedLogs.get("runs/old.log")).toBe("actual finalized error log");
  } finally {
    download.mockRestore();
  }
});

test("a prepared timeout log intent waits for its saved result before log admission", async () => {
  const f = await fixture("timed_out");
  const { summary: _summary, ...record } = f.record;
  await f.store.set("run:old", record);
  await rememberRunLog(f.store, "old");
  await recoverEnvironmentCleanup.run(f.ctx, {});
  expect(f.admissions.filter((command) => command === "runs.collect-log")).toEqual([]);
  expect(await f.store.collection("pending-run-logs").get("old")).toMatchObject({ runId: "old" });
  await f.store.set("run:old", f.record);
  await recoverEnvironmentCleanup.run(f.ctx, {});
  expect(f.admissions.filter((command) => command === "runs.collect-log")).toHaveLength(1);
  expect(f.requests).toEqual([]);
});
