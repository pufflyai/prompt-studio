import { expect, spyOn, test } from "bun:test";
import type { ExtensionConnectionsApi } from "@pstdio/sdk/extensions";
import { makeCommandContext } from "@pstdio/sdk/testing";
import { PocketCoderError } from "./connection";
import { cleanupEnvironmentCommand, recoverEnvironmentCleanup } from "./environment-cleanup";
import { activeRun, claimEnvironment } from "./environments";
import { runDeadline } from "./run-deadline";
import { createRunStorage } from "./run-storage-fixture";
import { saveTimedOutRun } from "./run-timeout";
import { checkRun, type RunRecord } from "./runs";

const record = (): RunRecord => ({
  runId: "run",
  environmentId: "env",
  requestId: "request",
  conversationId: "conversation",
  root: "/",
  command: "bun test",
  startedAt: new Date(Date.now() - 2_000_000).toISOString(),
  timeoutSeconds: 60,
  stopAfterRun: true,
});

test.each([
  "checkpoint",
  "summary",
])("a cleanup intent cannot stop the workspace before its timeout outcome is durable (%s)", async (stage) => {
  const store = createRunStorage();
  const run = record();
  await store.set("run:run", run);
  await claimEnvironment(store, "env", "run");
  const parent = new AbortController();
  const commit = store.records.commitIfCurrent;
  store.records.commitIfCurrent = async (group) => {
    if (group.edits.some((edit) => edit.set?.[stage === "checkpoint" ? "/pendingResult" : "/summary"])) {
      parent.abort(new Error("Host restarted before timeout checkpoint"));
      throw parent.signal.reason;
    }
    return commit(group);
  };
  const summary = {
    runId: "run",
    environmentId: "env",
    status: "timed_out" as const,
    durationMs: 60000,
    exitCode: null,
    logPath: null,
    tail: "",
  };
  const deps = {
    store,
    api: async () => {
      throw new PocketCoderError(503, "Unavailable");
    },
    storage: { download: async () => null },
    saveLog: async () => "unused",
  };
  await expect(saveTimedOutRun(deps, run, summary, false, true, parent.signal)).rejects.toThrow("Host restarted");
  expect((await store.get<RunRecord>("run:run"))?.summary).toBeUndefined();
  let stops = 0;
  const queued: string[] = [];
  const request: ExtensionConnectionsApi["request"] = async <T>(
    _id: string,
    input: Parameters<ExtensionConnectionsApi["request"]>[1],
  ) => {
    if (input.method === "POST") stops++;
    return { status: 200, headers: {}, body: { id: "env", state: "ready" } as T };
  };
  const ctx = makeCommandContext({
    storage: store,
    params: {},
    overrides: {
      connections: { request },
      automation: {
        enqueue: async (input) => {
          const commandId = typeof input.command === "string" ? input.command : input.command.id;
          queued.push(commandId);
          return {
            id: `job-${queued.length}`,
            commandId,
            projectId: "project",
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
  await recoverEnvironmentCleanup.run(ctx, {});
  expect(queued).not.toContain("environments.cleanup-run");
  await cleanupEnvironmentCommand.run(ctx, { environmentId: "env", runId: "run", stop: true });
  expect(stops).toBe(0);
  expect(await activeRun(store, "env")).toBe("run");
  expect(await store.collection("environment-cleanups").get("run:env")).toBeDefined();
  store.records.commitIfCurrent = commit;
  await expect(saveTimedOutRun(deps, run, summary, false, true)).resolves.toEqual(summary);
  await cleanupEnvironmentCommand.run(ctx, { environmentId: "env", runId: "run", stop: true });
  expect(stops).toBe(1);
  expect((await store.get<RunRecord>("run:run"))?.summary).toEqual(summary);
  expect(await activeRun(store, "env")).toBeNull();
});

test("crossing the deadline during saved-record reload gets a fresh final receipt", async () => {
  const store = createRunStorage();
  const run = { ...record(), startedAt: new Date(Date.now() - 1_860_000 + 150).toISOString() };
  await store.set("run:run", run);
  await claimEnvironment(store, "env", "run");
  const get = store.get;
  let reads = 0;
  let delayed = false;
  store.get = async <T>(key: string) => {
    if (key === "run:run" && reads === 1 && !delayed) {
      delayed = true;
      await Bun.sleep(Math.max(0, runDeadline(run) - Date.now()) + 5);
    }
    return get<T>(key);
  };
  const result = await checkRun(
    {
      store,
      api: async () => {
        reads++;
        return (
          reads === 1
            ? { finalizedAt: null }
            : {
                finalizedAt: new Date().toISOString(),
                acceptance: { execution: {} },
                outcome: { finalResponse: 'REMOTE_TEST_RESULT {"exitCode":0,"durationMs":17,"timedOut":false}' },
              }
        ) as never;
      },
      storage: { download: async () => null },
      saveLog: async () => "unused",
    },
    run,
  );
  expect(result).toMatchObject({ status: "passed", durationMs: 17 });
  expect(reads).toBe(3); // Two receipt reads plus the normal post-result workspace stop.
  expect(await store.collection("environment-cleanups").get("run:env")).toBeUndefined();
});

test("legacy claims for ended owned workspaces are reconciled and released without another stop", async () => {
  const store = createRunStorage();
  await store.collection("environment-claims").put("env", { runId: "run", until: Date.now() - 1 });
  const queued: Parameters<import("@pstdio/sdk/extensions").ExtensionAutomationApi["enqueue"]>[0][] = [];
  let stops = 0;
  const request: ExtensionConnectionsApi["request"] = async <T>(
    _id: string,
    input: Parameters<ExtensionConnectionsApi["request"]>[1],
  ) => {
    const owned = {
      id: "env",
      state: "canceled",
      metadata: { purpose: "remote-testing", pstdio_project_id: "project" },
    };
    if (input.method === "POST") stops++;
    return {
      status: 200,
      headers: {},
      body: (input.path.startsWith("/v1/workspaces?") ? { items: [owned], next_cursor: null } : owned) as T,
    };
  };
  const ctx = makeCommandContext({
    storage: store,
    projectId: "project",
    params: {},
    overrides: {
      connections: { request },
      automation: {
        enqueue: async (input) => {
          queued.push(input);
          return {
            id: "job",
            commandId: "environments.cleanup-run",
            projectId: "project",
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
  await recoverEnvironmentCleanup.run(ctx, {});
  expect(queued).toHaveLength(1);
  await cleanupEnvironmentCommand.run(ctx, queued[0]!.input.params as never);
  expect(stops).toBe(0);
  expect(await activeRun(store, "env")).toBeNull();
});

test("a deadline crossed after the receipt helper returns cannot authorize a timeout", async () => {
  const store = createRunStorage();
  const run = record();
  await store.set("run:run", run);
  await claimEnvironment(store, "env", "run");
  const deadline = runDeadline(run);
  let returned = false;
  let postReadClockCalls = 0;
  let reads = 0;
  const clock = spyOn(Date, "now").mockImplementation(() =>
    returned && ++postReadClockCalls > 1 ? deadline + 1 : deadline - 1,
  );
  const deps = {
    store,
    api: async ({ method }: { method: string }) => {
      if (method === "POST") return {} as never;
      reads++;
      returned = true;
      return (
        reads === 1
          ? { finalizedAt: null }
          : {
              finalizedAt: "2026-01-01T00:00:00Z",
              acceptance: { execution: {} },
              outcome: { finalResponse: 'REMOTE_TEST_RESULT {"exitCode":0,"durationMs":17,"timedOut":false}' },
            }
      ) as never;
    },
    storage: { download: async () => null },
    saveLog: async () => "unused",
  };
  try {
    expect(await checkRun(deps, run)).toBeNull();
    expect(reads).toBe(1);
    expect((await store.get<RunRecord>("run:run"))?.summary).toBeUndefined();
    clock.mockReturnValue(deadline + 2);
    expect(await checkRun(deps, run)).toMatchObject({ status: "passed", durationMs: 17 });
    expect(reads).toBe(2);
  } finally {
    clock.mockRestore();
  }
});
