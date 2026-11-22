import { expect, test } from "bun:test";
import type { ExtensionConnectionsApi } from "@pstdio/sdk/extensions";
import { createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import { connectionApi } from "./connection";
import { activeRun, claimEnvironment } from "./environments";
import { localProcess } from "./process-fixture";
import { awaitRun, checkRun, type RunDeps, type RunRecord } from "./runs";

function fixture(request: ExtensionConnectionsApi["request"]) {
  const store = createMemoryStorage();
  const ctx = makeCommandContext({ storage: store, params: {}, overrides: { connections: { request } } });
  const record: RunRecord = {
    runId: "run",
    environmentId: "env",
    requestId: "request",
    conversationId: "conversation",
    command: "bun test",
    root: "/",
    startedAt: new Date().toISOString(),
    timeoutSeconds: 60,
    stopAfterRun: true,
  };
  const deps: RunDeps = {
    projectId: "owned",
    api: connectionApi(ctx.connections),
    store,
    process: localProcess,
    cleanupEnvironment: async () => {},
    settings: {
      templateName: "tests",
      templateVersion: "1",
      testCommand: "bun test",
      timeoutMinutes: 1,
      storageBucket: "fixture",
      signerAccount: "fixture",
    },
    storage: {
      upload: async () => {},
      signedUrl: async () => "unused",
      download: async () => new TextEncoder().encode("finished"),
    },
    saveLog: async () => "run.log",
  };
  return { deps, record };
}

const receipt = {
  finalizedAt: "2026-01-01T00:00:00Z",
  acceptance: { execution: {} },
  outcome: { finalResponse: 'REMOTE_TEST_RESULT {"exitCode":0,"durationMs":10,"timedOut":false}' },
};

test.each([
  "network",
  "server",
  "status-zero",
])("collection resumes after a transient receipt failure (%s)", async (failure) => {
  let reads = 0;
  let stops = 0;
  const { deps, record } = fixture(
    async <TBody>(_id: string, input: Parameters<ExtensionConnectionsApi["request"]>[1]) => {
      if (input.method === "POST") stops++;
      else if (++reads === 1) {
        if (failure === "network") throw new Error("Connection reset");
        if (failure === "status-zero") throw Object.assign(new Error("Network unavailable"), { status: 0 });
        return { status: 503, headers: {}, body: { error: { message: "Temporarily unavailable" } } as TBody };
      }
      return { status: 200, headers: {}, body: receipt as TBody };
    },
  );
  await claimEnvironment(deps.store, record.environmentId, record.runId, 60);
  const summary = await awaitRun(deps, record);
  expect(summary).toMatchObject({ status: "passed", logPath: "run.log", tail: "finished" });
  expect(reads).toBe(2);
  expect(stops).toBe(1);
  expect(await deps.store.get("run:run")).toMatchObject({ summary });
  expect(await activeRun(deps.store, "env")).toBeNull();
});

test("collection surfaces permanent controller authentication failure", async () => {
  let reads = 0;
  const { deps, record } = fixture(async <TBody>() => {
    reads++;
    return { status: 401, headers: {}, body: { error: { message: "Sign in again" } } as TBody };
  });
  await expect(awaitRun(deps, record)).rejects.toThrow("PocketCoder HTTP 401");
  expect(reads).toBe(1);
  expect(await deps.store.get("run:run")).toBeUndefined();
});

test("aborting a transient receipt wait preserves the cancellation and stops polling", async () => {
  const entered = Promise.withResolvers<void>();
  const controller = new AbortController();
  let reads = 0;
  const { deps, record } = fixture(async () => {
    reads++;
    entered.resolve();
    throw new Error("Connection reset");
  });
  const waiting = awaitRun(deps, record, controller.signal);
  void waiting.catch(() => {});
  await entered.promise;
  await Bun.sleep(0);
  const reason = new Error("Collector canceled");
  controller.abort(reason);
  await expect(waiting).rejects.toBe(reason);
  expect(reads).toBe(1);
  expect(await deps.store.get("run:run")).toBeUndefined();
});

test("a single view receipt check reports a transient failure without background polling", async () => {
  let reads = 0;
  const failure = new Error("Connection reset");
  const { deps, record } = fixture(async () => {
    reads++;
    throw failure;
  });
  await expect(checkRun(deps, record)).rejects.toBe(failure);
  expect(reads).toBe(1);
});

test.each([401, 403])("collection surfaces structured host HTTP %i errors", async (status) => {
  const failure = Object.assign(new Error("Host denied this request"), { name: "PstdioApiError", status });
  const entered = Promise.withResolvers<void>();
  const controller = new AbortController();
  const { deps, record } = fixture(async () => {
    entered.resolve();
    throw failure;
  });
  let observed: unknown;
  const waiting = awaitRun(deps, record, controller.signal);
  void waiting.catch((error) => {
    observed = error;
  });
  await entered.promise;
  await Bun.sleep(0);
  const surfaced = observed;
  controller.abort(new Error("Fixture cleanup"));
  await waiting.catch(() => {});
  expect(surfaced).toBe(failure);
});

test("recovered collection preserves a newer owner after the original lease expires", async () => {
  const entered = Promise.withResolvers<void>();
  let reads = 0;
  let stops = 0;
  const { deps, record } = fixture(
    async <TBody>(_id: string, input: Parameters<ExtensionConnectionsApi["request"]>[1]) => {
      if (input.method === "POST") stops++;
      else if (++reads === 1) {
        entered.resolve();
        throw new Error("Connection reset");
      }
      return { status: 200, headers: {}, body: receipt as TBody };
    },
  );
  await claimEnvironment(deps.store, "env", "run", -1);
  const waiting = awaitRun(deps, record);
  await entered.promise;
  expect(await claimEnvironment(deps.store, "env", "new-owner", 60)).toBe(true);
  const summary = await waiting;
  expect(summary.status).toBe("passed");
  expect(stops).toBe(0);
  expect(await activeRun(deps.store, "env")).toBe("new-owner");
  expect(await deps.store.get("run:run")).toMatchObject({ summary });
});

test.each(["expired", "missing"])("terminal cleanup requires a matching claim (%s)", async (claim) => {
  let stops = 0;
  let ownerAtStop: string | null = null;
  const { deps, record } = fixture(
    async <TBody>(_id: string, input: Parameters<ExtensionConnectionsApi["request"]>[1]) => {
      if (input.method === "POST") {
        stops++;
        ownerAtStop = await activeRun(deps.store, "env");
      }
      return { status: 200, headers: {}, body: receipt as TBody };
    },
  );
  if (claim === "expired") await claimEnvironment(deps.store, "env", "run", -1);
  expect((await awaitRun(deps, record)).status).toBe("passed");
  expect(stops).toBe(claim === "expired" ? 1 : 0);
  expect<string | null>(ownerAtStop).toBe(claim === "expired" ? "run" : null);
});

test.each(["network", "server"])("terminal collection recovers a transient stop failure (%s)", async (failure) => {
  let reads = 0;
  let stops = 0;
  const { deps, record } = fixture(
    async <TBody>(_id: string, input: Parameters<ExtensionConnectionsApi["request"]>[1]) => {
      if (input.method === "GET") reads++;
      else if (++stops === 1) {
        if (failure === "network") throw new Error("Connection reset during stop");
        return { status: 503, headers: {}, body: { error: { message: "Stop temporarily unavailable" } } as TBody };
      }
      return { status: 200, headers: {}, body: receipt as TBody };
    },
  );
  await claimEnvironment(deps.store, "env", "run", 60);
  const summary = await awaitRun(deps, record);
  expect(summary).toMatchObject({ status: "passed", logPath: "run.log" });
  expect(reads).toBe(1);
  expect(stops).toBe(2);
  expect(await deps.store.get("run:run")).toMatchObject({ summary });
  expect(await activeRun(deps.store, "env")).toBeNull();
});

test("a shutdown retry rechecks ownership before touching a newly claimed environment", async () => {
  let stops = 0;
  const { deps, record } = fixture(
    async <TBody>(_id: string, input: Parameters<ExtensionConnectionsApi["request"]>[1]) => {
      if (input.method === "POST") {
        stops++;
        const claims = deps.store.collection<{ runId: string; until: number }>("environment-claims");
        const current = await claims.read("env");
        if (!current) throw new Error("Missing fixture claim");
        await claims.updateIfUnchanged("env", current.revision, { runId: "run", until: Date.now() - 1 });
        expect(await claimEnvironment(deps.store, "env", "new-owner", 60)).toBe(true);
        return { status: 503, headers: {}, body: { error: { message: "Controller unavailable" } } as TBody };
      }
      return { status: 200, headers: {}, body: receipt as TBody };
    },
  );
  await claimEnvironment(deps.store, "env", "run", 60);
  const summary = await awaitRun(deps, record);
  expect(summary.status).toBe("passed");
  expect(stops).toBe(1);
  expect(await activeRun(deps.store, "env")).toBe("new-owner");
  expect(await deps.store.get("run:run")).toMatchObject({ summary });
});
