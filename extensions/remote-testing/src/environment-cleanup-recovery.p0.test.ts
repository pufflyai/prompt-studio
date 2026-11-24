import { expect, test } from "bun:test";
import type { ExtensionAutomationApi, ExtensionConnectionsApi } from "@pstdio/sdk/extensions";
import { makeCommandContext } from "@pstdio/sdk/testing";
import { PocketCoderError } from "./connection";
import {
  cleanupEnvironmentCommand,
  cleanupRunEnvironment,
  enqueueEnvironmentCleanup,
  recoverEnvironmentCleanup,
  rememberEnvironmentCleanup,
} from "./environment-cleanup";
import { activeRun, claimEnvironment, releaseEnvironment } from "./environments";
import { unfinishedRuns } from "./run-recovery";
import { createRunStorage as createMemoryStorage } from "./run-storage-fixture";
import { runsView } from "./workbench";

test.each(["network", "server"])("failed-launch cleanup recovers a temporary stop failure (%s)", async (failure) => {
  const store = createMemoryStorage();
  await claimEnvironment(store, "env", "owner");
  let attempts = 0;
  const result = await cleanupRunEnvironment(
    {
      store,
      api: async (_path, init) => {
        if (init?.method !== "POST") return { id: "env", state: "ready" } as never;
        expect(await activeRun(store, "env")).toBe("owner");
        if (++attempts === 1) {
          if (failure === "network") throw new Error("Connection reset");
          throw new PocketCoderError(503, "Temporarily unavailable");
        }
        return {} as never;
      },
    },
    { environmentId: "env", runId: "owner", stop: true },
  );
  expect(result).toEqual({ stopped: true });
  expect(attempts).toBe(2);
  expect(await activeRun(store, "env")).toBeNull();
});

test("a failed-launch cleanup retry preserves a newer environment owner", async () => {
  const store = createMemoryStorage();
  await claimEnvironment(store, "env", "owner");
  let stops = 0;
  const result = await cleanupRunEnvironment(
    {
      store,
      api: async (_path, init) => {
        if (init?.method !== "POST") return { id: "env", state: "ready" } as never;
        stops++;
        await releaseEnvironment(store, "env", "owner");
        expect(await claimEnvironment(store, "env", "new-owner")).toBe(true);
        throw new PocketCoderError(503, "Temporary failure");
      },
    },
    { environmentId: "env", runId: "owner", stop: true },
  );
  expect(result).toEqual({ stopped: false });
  expect(stops).toBe(1);
  expect(await activeRun(store, "env")).toBe("new-owner");
});

type Job = NonNullable<Awaited<ReturnType<ExtensionAutomationApi["get"]>>>;
async function recoveryFixture() {
  const store = createMemoryStorage();
  await claimEnvironment(store, "env", "owner");
  const jobs = new Map<string, Job>();
  const queued: Parameters<ExtensionAutomationApi["enqueue"]>[0][] = [];
  const keys = new Map<string, string>();
  let stops = 0;
  let state = "ready";
  const request: ExtensionConnectionsApi["request"] = async <T>(
    _id: string,
    input: Parameters<ExtensionConnectionsApi["request"]>[1],
  ) => {
    if (input.method === "POST") {
      stops++;
      state = "canceled";
    }
    return { status: 200, headers: {}, body: { id: "env", state } as T };
  };
  const ctx = makeCommandContext({
    storage: store,
    params: {},
    overrides: {
      extensionId: "pocketcoder.remote-testing",
      connections: { request },
      settings: { all: async () => ({ templateVersion: "1", storageBucket: "fixture", signerAccount: "fixture" }) },
      automation: {
        get: async (id) => jobs.get(id),
        enqueue: async (input) => {
          queued.push(input);
          const replay = keys.get(input.key);
          if (replay) return jobs.get(replay)!;
          const id = `job-${jobs.size}`;
          const job: Job = {
            id,
            projectId: "project",
            commandId: "environments.cleanup-run",
            status: "queued",
            createdAt: new Date().toISOString(),
            startedAt: null,
            finishedAt: null,
            error: null,
            result: null,
          };
          jobs.set(id, job);
          keys.set(input.key, id);
          return job;
        },
      },
    },
  });
  const query = () => {
    if (runsView.body.kind !== "dataTable") throw new Error("Expected a table");
    return runsView.body.query(ctx);
  };
  return { ctx, store, jobs, queued, query, stops: () => stops };
}

test("opening Runs recovers interrupted failed-launch cleanup without a saved run", async () => {
  const f = await recoveryFixture();
  const input = { environmentId: "env", runId: "owner", stop: true };
  await enqueueEnvironmentCleanup(f.ctx, input);
  f.jobs.get("job-0")!.status = "failed";
  f.jobs.get("job-0")!.error = { code: "host_restarted", message: "Host restarted", retryable: true };
  await f.query();
  expect(f.jobs.size).toBe(2);
  expect(f.queued.at(-1)!.input.params).toEqual(input);
  const admissions = f.queued.length;
  await f.query();
  expect(f.queued).toHaveLength(admissions);
  await cleanupEnvironmentCommand.run(f.ctx, input);
  expect(f.stops()).toBe(1);
  expect(await activeRun(f.store, "env")).toBeNull();
  f.jobs.get("job-1")!.status = "succeeded";
  await f.query();
  expect(f.queued).toHaveLength(admissions);
});

test("durable cleanup reconciles after a non-retryable host failure and retains its error", async () => {
  const f = await recoveryFixture();
  await enqueueEnvironmentCleanup(f.ctx, { environmentId: "env", runId: "owner", stop: true });
  f.jobs.get("job-0")!.status = "failed";
  f.jobs.get("job-0")!.error = { code: "command_failed", message: "Sign in again", retryable: false };
  await f.query();
  expect(f.jobs.size).toBe(2);
  expect(f.jobs.get("job-0")!.error).toMatchObject({ code: "command_failed", retryable: false });
  expect(f.jobs.get("job-1")!.status).toBe("queued");
  const admissions = f.queued.length;
  await f.query();
  expect(f.queued).toHaveLength(admissions);
  expect(f.stops()).toBe(0);
});

test("cleanup releases ownership when a same-owner record changes during release", async () => {
  const store = createMemoryStorage();
  await claimEnvironment(store, "env", "owner");
  let first = true;
  const racing = {
    ...store,
    collection<T>(name: string) {
      const collection = store.collection<T>(name);
      return {
        ...collection,
        async deleteIfValue(id: string, value: T) {
          if (name === "environment-claims" && first) {
            first = false;
            const claims = store.collection<{ runId: string; until: number }>(name);
            const current = await claims.read(id);
            if (!current) throw new Error("Expected an owned claim");
            await claims.updateIfUnchanged(id, current.revision, { ...current.value, until: Date.now() + 120000 });
            return false;
          }
          return collection.deleteIfValue(id, value);
        },
      };
    },
  };
  let stops = 0;
  expect(
    await cleanupRunEnvironment(
      {
        store: racing,
        api: async (_path, init) => {
          if (init?.method !== "POST") return { id: "env", state: "ready" } as never;
          stops++;
          return {} as never;
        },
      },
      { environmentId: "env", runId: "owner", stop: true },
    ),
  ).toEqual({ stopped: true });
  expect(stops).toBe(1);
  expect(await activeRun(store, "env")).toBeNull();
});

test("canceled setup queues cleanup before reading its canceled host storage", async () => {
  const f = await recoveryFixture();
  const parent = new AbortController();
  const scoped = {
    ...f.store,
    collection<T>(name: string) {
      const collection = f.store.collection<T>(name);
      return {
        ...collection,
        async read(id: string) {
          parent.signal.throwIfAborted();
          return collection.read(id);
        },
      };
    },
  };
  const canceled = makeCommandContext({
    storage: scoped,
    params: {},
    overrides: {
      signal: parent.signal,
      automation: f.ctx.automation,
    },
  });
  parent.abort();
  await enqueueEnvironmentCleanup(canceled, { environmentId: "env", runId: "owner", stop: true });
  expect(f.queued).toHaveLength(1);
  await cleanupEnvironmentCommand.run(f.ctx, { environmentId: "env", runId: "owner", stop: true });
  expect(f.stops()).toBe(1);
  expect(await activeRun(f.store, "env")).toBeNull();
});

test("opening a saved timeout resumes its independent workspace cleanup", async () => {
  const f = await recoveryFixture();
  const input = { environmentId: "env", runId: "owner", stop: true };
  await rememberEnvironmentCleanup(f.store, input);
  await f.store.set("run:owner", {
    runId: "owner",
    environmentId: "env",
    requestId: "request",
    conversationId: "conversation",
    root: "/",
    command: "bun test",
    startedAt: "2026-01-01T00:00:00Z",
    timeoutSeconds: 60,
    stopAfterRun: true,
    summary: {
      runId: "owner",
      environmentId: "env",
      status: "timed_out",
      exitCode: null,
      durationMs: 1000,
      logPath: null,
      tail: "",
    },
  });
  const table = await f.query();
  expect(table.rows[0]?.values.status).toBe("timed_out");
  expect(f.queued).toHaveLength(1);
  expect(f.queued[0]?.input.params).toEqual(input);
  expect(await activeRun(f.store, "env")).toBe("owner");
  await cleanupEnvironmentCommand.run(f.ctx, input);
  expect(f.stops()).toBe(1);
  expect(await activeRun(f.store, "env")).toBeNull();
  expect(await f.store.get("run:owner")).toMatchObject({ summary: { status: "timed_out" } });
});

test("an expired setup claim is recoverable without a run or cleanup record", async () => {
  const f = await recoveryFixture();
  await f.store.collection("environment-claims").put("env", {
    runId: "owner",
    setup: { until: Date.now() - 1, stop: false, environmentId: "env" },
  });
  await recoverEnvironmentCleanup.run(f.ctx, {});
  expect(f.queued).toHaveLength(1);
  expect(f.queued[0]?.input.params).toEqual({ environmentId: "env", runId: "owner", stop: false });
  expect(await activeRun(f.store, "env")).toBe("owner");
  await cleanupEnvironmentCommand.run(f.ctx, { environmentId: "env", runId: "owner", stop: false });
  expect(f.stops()).toBe(0);
  expect(await activeRun(f.store, "env")).toBeNull();
});

test("a record-backed claim recovers collection after acknowledgement but before collector admission", async () => {
  const f = await recoveryFixture();
  await f.store.set("run:owner", {
    runId: "owner",
    environmentId: "env",
    requestId: "request",
    conversationId: "conversation",
    root: "/",
    command: "bun test",
    startedAt: new Date().toISOString(),
    timeoutSeconds: 60,
    stopAfterRun: false,
    submissionPending: false,
  });
  await recoverEnvironmentCleanup.run(f.ctx, {});
  expect(f.queued).toHaveLength(1);
  expect(f.queued[0]?.command).toMatchObject({ id: "runs.collect" });
  expect(f.queued[0]?.input.params).toEqual({ runId: "owner" });
  expect(await activeRun(f.store, "env")).toBe("owner");
  expect(f.stops()).toBe(0);
});

test("an unfinished durable run recovers after terminal-proof release but before summary persistence", async () => {
  const f = await recoveryFixture();
  await releaseEnvironment(f.store, "env", "owner");
  await f.store.set("run:owner", {
    runId: "owner",
    environmentId: "env",
    requestId: "request",
    conversationId: "conversation",
    root: "/",
    command: "bun test",
    startedAt: new Date().toISOString(),
    timeoutSeconds: 60,
    stopAfterRun: false,
    submissionPending: false,
  });
  await recoverEnvironmentCleanup.run(f.ctx, {});
  expect(f.queued).toHaveLength(1);
  expect(f.queued[0]?.command).toMatchObject({ id: "runs.collect" });
  expect(f.queued[0]?.input.params).toEqual({ runId: "owner" });
  expect(f.stops()).toBe(0);
});

test("unfinished-run recovery visits later pages while completed summaries change the owner revision", async () => {
  const f = await recoveryFixture();
  await releaseEnvironment(f.store, "env", "owner");
  for (let index = 0; index < 101; index++) {
    const runId = `run-${String(index).padStart(3, "0")}`;
    await f.store.set(`run:${runId}`, {
      runId,
      environmentId: "env",
      requestId: `request-${index}`,
      conversationId: "conversation",
      root: "/",
      command: "bun test",
      startedAt: new Date().toISOString(),
      timeoutSeconds: 60,
      stopAfterRun: false,
      submissionPending: false,
    });
  }
  const visited = new Set<string>();
  for await (const record of unfinishedRuns(f.store)) {
    visited.add(record.runId);
    await f.store.set(`run:${record.runId}`, { ...record, summary: { status: "passed" } });
  }
  expect(visited.size).toBe(101);
  expect(f.stops()).toBe(0);
});

test("unfinished recovery leaves a record owned by its matching setup claim alone", async () => {
  const f = await recoveryFixture();
  await f.store
    .collection("environment-claims")
    .put("env", { runId: "owner", setup: { environmentId: "env", until: Date.now() + 60000, stop: false } });
  await f.store.set("run:owner", {
    runId: "owner",
    environmentId: "env",
    requestId: "request",
    conversationId: "conversation",
    root: "/",
    command: "bun test",
    startedAt: new Date().toISOString(),
    timeoutSeconds: 60,
    stopAfterRun: false,
    submissionPending: true,
  });
  await recoverEnvironmentCleanup.run(f.ctx, {});
  expect(f.queued).toHaveLength(0);
  expect(await activeRun(f.store, "env")).toBe("owner");
});

test("an expired legacy orphan stays owned until its owned workspace is stopped", async () => {
  const f = await recoveryFixture();
  await f.store.collection("environment-claims").put("env", { runId: "owner", until: Date.now() - 1 });
  let state = "ready";
  let stops = 0;
  f.ctx.connections.request = async <T>(_id: string, input: Parameters<ExtensionConnectionsApi["request"]>[1]) => {
    const owned = { id: "env", state, metadata: { purpose: "remote-testing", pstdio_project_id: f.ctx.projectId } };
    if (input.path.startsWith("/v1/workspaces?"))
      return {
        status: 200,
        headers: {},
        body: {
          items: [
            owned,
            { ...owned, id: "foreign", metadata: { ...owned.metadata, pstdio_project_id: "another-project" } },
          ],
          next_cursor: null,
        } as T,
      };
    if (input.method === "POST") {
      stops++;
      state = "canceled";
    }
    return { status: 200, headers: {}, body: { ...owned, state } as T };
  };
  await recoverEnvironmentCleanup.run(f.ctx, {});
  expect(f.queued).toHaveLength(1);
  expect(f.queued[0]?.command).toMatchObject({ id: "environments.cleanup-run" });
  expect(await activeRun(f.store, "env")).toBe("owner");
  await cleanupEnvironmentCommand.run(f.ctx, f.queued[0]!.input.params as never);
  expect(stops).toBe(1);
  expect(await activeRun(f.store, "env")).toBeNull();
});

test("cleanup recovers a non-retryable release failure without repeating an accepted stop", async () => {
  const f = await recoveryFixture();
  const input = { environmentId: "env", runId: "owner", stop: true };
  let state = "ready";
  let stops = 0;
  f.ctx.connections.request = async <T>(_id: string, request: Parameters<ExtensionConnectionsApi["request"]>[1]) => {
    if (request.method === "POST") {
      stops++;
      state = "canceled";
    }
    return { status: 200, headers: {}, body: { id: "env", state } as T };
  };
  const collection = f.store.collection.bind(f.store);
  let unavailable = true;
  f.store.collection = <T>(name: string) => {
    const current = collection<T>(name);
    return {
      ...current,
      deleteIfValue: async (id: string, value: T) => {
        if (unavailable && name === "environment-claims") throw new Error("Release storage unavailable");
        return current.deleteIfValue(id, value);
      },
    };
  };
  await enqueueEnvironmentCleanup(f.ctx, input);
  await expect(cleanupEnvironmentCommand.run(f.ctx, input)).rejects.toThrow("Release storage unavailable");
  f.jobs.get("job-0")!.status = "failed";
  f.jobs.get("job-0")!.error = { code: "command_failed", message: "Release storage unavailable", retryable: false };
  unavailable = false;
  await recoverEnvironmentCleanup.run(f.ctx, {});
  expect(f.jobs.size).toBe(2);
  await cleanupEnvironmentCommand.run(f.ctx, input);
  expect(stops).toBe(1);
  expect(await activeRun(f.store, "env")).toBeNull();
});

test.each([
  "before lookup",
  "during lookup",
])("legacy cleanup hands a newly visible run back to collection (%s)", async (visible) => {
  const f = await recoveryFixture();
  await f.store.collection("environment-claims").put("env", {
    runId: "owner",
    until: Number.MAX_SAFE_INTEGER,
    legacy: { environmentId: "env" },
  });
  const reveal = () =>
    f.store.set("run:owner", {
      runId: "owner",
      environmentId: "env",
      requestId: "request",
      conversationId: "conversation",
      root: "/",
      command: "bun test",
      startedAt: new Date().toISOString(),
      timeoutSeconds: 60,
      stopAfterRun: false,
      submissionPending: false,
    });
  if (visible === "before lookup") await reveal();
  let stops = 0;
  f.ctx.connections.request = async <T>(_id: string, request: Parameters<ExtensionConnectionsApi["request"]>[1]) => {
    if (request.method === "POST") stops++;
    else await reveal();
    return { status: 200, headers: {}, body: { id: "env", state: "ready" } as T };
  };
  await cleanupEnvironmentCommand.run(f.ctx, { environmentId: "env", runId: "owner", stop: true, orphan: true });
  expect(stops).toBe(0);
  expect(await f.store.collection("environment-claims").get("env")).toEqual({
    runId: "owner",
    until: Number.MAX_SAFE_INTEGER,
  });
  expect(await claimEnvironment(f.store, "env", "competitor")).toBe(false);
});
