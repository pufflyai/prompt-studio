import { expect, test } from "bun:test";
import type { ExtensionConnectionsApi } from "@pstdio/sdk/extensions";
import { createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import { connectionApi } from "./connection";
import { activeRun, claimEnvironment, releaseEnvironment } from "./environments";
import { localProcess } from "./process-fixture";
import { awaitRun, cancelRun, checkRun, type RunDeps, type RunRecord } from "./runs";

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

test("a crashed runner cannot keep an unfinished run and its workspace open past the deadline", async () => {
  const calls: string[] = [];
  const { deps, record } = fixture(
    async <TBody>(_id: string, input: Parameters<ExtensionConnectionsApi["request"]>[1]) => {
      calls.push(`${input.method} ${input.path}`);
      return { status: 200, headers: {}, body: { finalizedAt: null, acceptance: { execution: {} } } as TBody };
    },
  );
  record.startedAt = new Date(Date.now() - 2_000_000).toISOString();
  await claimEnvironment(deps.store, "env", "run");
  const summary = await checkRun(deps, record);
  expect(summary).toMatchObject({ status: "timed_out", exitCode: null });
  expect(summary?.error).toContain("final receipt");
  expect(calls).toEqual(["GET /v1/workspaces/env/requests/request?conversationId=conversation"]);
  expect(await activeRun(deps.store, "env")).toBe("run");
  expect(await deps.store.collection("environment-cleanups").get("run:env")).toMatchObject({ stop: true });
  expect(await deps.store.get("run:run")).toMatchObject({ summary });
});

test("a receipt finalized before collection keeps its real result even after the deadline", async () => {
  const { deps, record } = fixture(async <TBody>() => ({ status: 200, headers: {}, body: receipt as TBody }));
  record.startedAt = new Date(Date.now() - 2_000_000).toISOString();
  expect(await checkRun(deps, record)).toMatchObject({ status: "passed", exitCode: 0 });
});

test("an unfinished run within its deadline remains active", async () => {
  const { deps, record } = fixture(async <TBody>() => ({
    status: 200,
    headers: {},
    body: { finalizedAt: null, acceptance: { execution: {} } } as TBody,
  }));
  await claimEnvironment(deps.store, "env", "run");
  expect(await checkRun(deps, record)).toBeNull();
  expect(await activeRun(deps.store, "env")).toBe("run");
});

test("a controller outage cannot make receipt retries outlive the run deadline", async () => {
  const calls: string[] = [];
  const { deps, record } = fixture(
    async <TBody>(_id: string, input: Parameters<ExtensionConnectionsApi["request"]>[1]) => {
      calls.push(`${input.method} ${input.path}`);
      if (input.method === "GET") throw new Error("Runner unreachable");
      return { status: 200, headers: {}, body: {} as TBody };
    },
  );
  record.startedAt = new Date(Date.now() - 1_859_900).toISOString();
  await claimEnvironment(deps.store, "env", "run");
  expect(await awaitRun(deps, record)).toMatchObject({ status: "timed_out", exitCode: null });
  expect(calls).toEqual([
    "GET /v1/workspaces/env/requests/request?conversationId=conversation",
    "GET /v1/workspaces/env/requests/request?conversationId=conversation",
  ]);
});

test("an overdue collector cannot stop a workspace now owned by another run", async () => {
  const calls: string[] = [];
  const { deps, record } = fixture(
    async <TBody>(_id: string, input: Parameters<ExtensionConnectionsApi["request"]>[1]) => {
      calls.push(input.method);
      return { status: 200, headers: {}, body: { finalizedAt: null, acceptance: { execution: {} } } as TBody };
    },
  );
  record.startedAt = new Date(Date.now() - 2_000_000).toISOString();
  await claimEnvironment(deps.store, "env", "new-owner");
  expect(await checkRun(deps, record)).toMatchObject({ status: "timed_out" });
  expect(calls).toEqual(["GET"]);
  expect(await activeRun(deps.store, "env")).toBe("new-owner");
});

test("source preparation does not consume the command timeout", async () => {
  const { deps, record } = fixture(async <TBody>() => ({
    status: 200,
    headers: {},
    body: { finalizedAt: null, acceptance: { execution: {} } } as TBody,
  }));
  record.startedAt = new Date(Date.now() - 120_000).toISOString();
  expect(await checkRun(deps, record)).toBeNull();
});

test("a kept workspace remains claimed until its overdue request actually stops", async () => {
  const calls: string[] = [];
  const { deps, record } = fixture(
    async <TBody>(_id: string, input: Parameters<ExtensionConnectionsApi["request"]>[1]) => {
      calls.push(`${input.method} ${input.path}`);
      return {
        status: 200,
        headers: {},
        body: { finalizedAt: null, acceptance: { execution: { requestId: "request" } } } as TBody,
      };
    },
  );
  record.startedAt = new Date(Date.now() - 2_000_000).toISOString();
  record.stopAfterRun = false;
  await claimEnvironment(deps.store, "env", "run");
  expect(await checkRun(deps, record)).toBeNull();
  expect(calls).toEqual([
    "GET /v1/workspaces/env/requests/request?conversationId=conversation",
    "POST /v1/workspaces/env/executions/request/cancel",
  ]);
  expect(await activeRun(deps.store, "env")).toBe("run");
  expect(await claimEnvironment(deps.store, "env", "next-run")).toBe(false);
  deps.api = async () => ({ ...receipt, outcome: { status: "canceled" } }) as never;
  expect(await checkRun(deps, record)).toMatchObject({ status: "canceled" });
  expect(await activeRun(deps.store, "env")).toBeNull();
});

test("an unavailable overdue request never frees a kept workspace for reuse", async () => {
  const { deps, record } = fixture(async () => {
    throw new Error("Controller unavailable");
  });
  record.startedAt = new Date(Date.now() - 2_000_000).toISOString();
  record.stopAfterRun = false;
  await claimEnvironment(deps.store, "env", "run");
  expect(await checkRun(deps, record)).toBeNull();
  expect(await activeRun(deps.store, "env")).toBe("run");
  expect(await deps.store.get("run:run")).toBeUndefined();
});

test("overdue collection respects a previously accepted manual cancellation", async () => {
  const calls: string[] = [];
  const { deps, record } = fixture(
    async <TBody>(_id: string, input: Parameters<ExtensionConnectionsApi["request"]>[1]) => {
      calls.push(input.method);
      return {
        status: 200,
        headers: {},
        body: { finalizedAt: null, cancel: { cancelId: "manual-cancel" }, acceptance: { execution: {} } } as TBody,
      };
    },
  );
  record.startedAt = new Date(Date.now() - 2_000_000).toISOString();
  record.stopAfterRun = false;
  await claimEnvironment(deps.store, "env", "run");
  expect(await checkRun(deps, record)).toBeNull();
  expect(await cancelRun(deps, record)).toBe(true);
  expect(calls).toEqual(["GET", "GET"]);
  expect(await activeRun(deps.store, "env")).toBe("run");
});

test("a lost cancel reply keeps the workspace claimed and retries the same cancel identity", async () => {
  const cancellations: unknown[] = [];
  const { deps, record } = fixture(
    async <TBody>(_id: string, input: Parameters<ExtensionConnectionsApi["request"]>[1]) => {
      if (input.method === "POST") {
        cancellations.push(input.body);
        throw new Error("Cancel reply lost");
      }
      return { status: 200, headers: {}, body: { finalizedAt: null, acceptance: { execution: {} } } as TBody };
    },
  );
  record.startedAt = new Date(Date.now() - 2_000_000).toISOString();
  record.stopAfterRun = false;
  await claimEnvironment(deps.store, "env", "run");
  expect(await checkRun(deps, record)).toBeNull();
  expect(await checkRun(deps, record)).toBeNull();
  expect(cancellations).toEqual([
    { execution: {}, cancelId: "run", scope: "operation" },
    { execution: {}, cancelId: "run", scope: "operation" },
  ]);
  expect(await activeRun(deps.store, "env")).toBe("run");
});

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
  await claimEnvironment(deps.store, record.environmentId, record.runId);
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

test("recovered collection preserves a newer owner after an explicit handoff", async () => {
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
  await claimEnvironment(deps.store, "env", "run");
  const waiting = awaitRun(deps, record);
  await entered.promise;
  await releaseEnvironment(deps.store, "env", "run");
  expect(await claimEnvironment(deps.store, "env", "new-owner")).toBe(true);
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
  if (claim === "expired") await claimEnvironment(deps.store, "env", "run");
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
  await claimEnvironment(deps.store, "env", "run");
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
        await releaseEnvironment(deps.store, "env", "run");
        expect(await claimEnvironment(deps.store, "env", "new-owner")).toBe(true);
        return { status: 503, headers: {}, body: { error: { message: "Controller unavailable" } } as TBody };
      }
      return { status: 200, headers: {}, body: receipt as TBody };
    },
  );
  await claimEnvironment(deps.store, "env", "run");
  const summary = await awaitRun(deps, record);
  expect(summary.status).toBe("passed");
  expect(stops).toBe(1);
  expect(await activeRun(deps.store, "env")).toBe("new-owner");
  expect(await deps.store.get("run:run")).toMatchObject({ summary });
});

test.each(["stop", "log"])("an overdue result is saved independently of an unavailable %s service", async (service) => {
  const { deps, record } = fixture(
    async <TBody>(_id: string, input: Parameters<ExtensionConnectionsApi["request"]>[1]) => {
      if (input.method === "POST" && service === "stop") return { status: 503, headers: {}, body: {} as TBody };
      return { status: 200, headers: {}, body: { finalizedAt: null, acceptance: { execution: {} } } as TBody };
    },
  );
  record.startedAt = new Date(Date.now() - 2_000_000).toISOString();
  deps.storage.download = async (_object, options) => {
    if (service === "log") {
      await new Promise<void>((_, reject) => {
        options?.signal?.addEventListener("abort", () => reject(options.signal?.reason), { once: true });
      });
    }
    return null;
  };
  await claimEnvironment(deps.store, "env", "run");
  expect(await checkRun(deps, record, AbortSignal.timeout(300), true)).toMatchObject({ status: "timed_out" });
  expect(await deps.store.get("run:run")).toMatchObject({ summary: { status: "timed_out" } });
  expect(await activeRun(deps.store, "env")).toBe("run");
  expect(await deps.store.collection("environment-cleanups").get("run:env")).toMatchObject({
    runId: "run",
    environmentId: "env",
    stop: true,
  });
});
