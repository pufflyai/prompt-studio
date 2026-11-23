import { afterAll, afterEach, expect, spyOn, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { activeRun, claimEnvironment } from "./environments";
import { localProcess } from "./process-fixture";
import { awaitRun, checkRun, type RunDeps, type RunRecord } from "./runs";
import { gcsStorage } from "./storage";

const fetchTarget: { fetch: (...args: Parameters<typeof fetch>) => ReturnType<typeof fetch> } = globalThis;
const fetchSpy = spyOn(fetchTarget, "fetch");
afterEach(() => fetchSpy.mockReset());
afterAll(() => fetchSpy.mockRestore());

async function fixture() {
  let stops = 0;
  let reads = 0;
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
    api: async <T>(input: { method: "GET" | "POST" }) => {
      if (input.method === "POST") stops++;
      else reads++;
      return {
        finalizedAt: "2026-01-01T00:00:00Z",
        acceptance: { execution: {} },
        outcome: { finalResponse: 'REMOTE_TEST_RESULT {"exitCode":0,"durationMs":10,"timedOut":false}' },
      } as T;
    },
    store: createMemoryStorage(),
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
    storage: gcsStorage({ bucket: "fixture", signer: "fixture", token: async () => "fixture" }),
    saveLog: async () => "run.log",
  };
  await claimEnvironment(deps.store, "env", "run", 60);
  return { deps, record, calls: () => ({ stops, reads }) };
}

test.each(["network", "503"])("completed collection recovers a transient log download failure (%s)", async (kind) => {
  const { deps, record, calls } = await fixture();
  let downloads = 0;
  const controller = new AbortController();
  fetchSpy.mockImplementation(async (_url, options) => {
    if (++downloads === 1) {
      if (kind === "network") throw new TypeError("Connection reset");
      return new Response("Temporarily unavailable", { status: 503 });
    }
    expect(options?.signal).toBe(controller.signal);
    return new Response("finished\nall tests passed");
  });
  const summary = await awaitRun(deps, record, controller.signal);
  expect(summary).toMatchObject({ status: "passed", logPath: "run.log", tail: "finished\nall tests passed" });
  expect(downloads).toBe(2);
  expect(calls()).toEqual({ reads: 1, stops: 1 });
  expect(await deps.store.get("run:run")).toMatchObject({ summary });
  expect(await activeRun(deps.store, "env")).toBeNull();
});

test.each([401, 403])("collection surfaces permanent log authentication failure (HTTP %i)", async (status) => {
  const { deps, record } = await fixture();
  fetchSpy.mockImplementation(async () => new Response("Sign in again", { status }));
  await expect(awaitRun(deps, record)).rejects.toThrow(`HTTP ${status}`);
  expect(fetchSpy).toHaveBeenCalledTimes(1);
  expect(await deps.store.get("run:run")).toBeUndefined();
});

test("a missing uploaded log still saves the terminal result and releases the claim", async () => {
  const { deps, record } = await fixture();
  fetchSpy.mockImplementation(async () => new Response(null, { status: 404 }));
  const summary = await awaitRun(deps, record);
  expect(summary).toMatchObject({ status: "passed", logPath: null, tail: "" });
  expect(await deps.store.get("run:run")).toMatchObject({ summary });
  expect(await activeRun(deps.store, "env")).toBeNull();
});

test("a view's one-shot log download does not start background retries", async () => {
  const { deps, record } = await fixture();
  fetchSpy.mockImplementation(async () => new Response("Unavailable", { status: 503 }));
  await expect(checkRun(deps, record)).rejects.toThrow("HTTP 503");
  expect(fetchSpy).toHaveBeenCalledTimes(1);
});

test("aborting a transient log wait preserves the reason and stops downloading", async () => {
  const { deps, record } = await fixture();
  const controller = new AbortController();
  const entered = Promise.withResolvers<void>();
  fetchSpy.mockImplementation(async () => {
    entered.resolve();
    throw new TypeError("Connection reset");
  });
  const waiting = awaitRun(deps, record, controller.signal);
  void waiting.catch(() => {});
  await entered.promise;
  await Bun.sleep(0);
  const reason = new Error("Collection interrupted");
  controller.abort(reason);
  await expect(waiting).rejects.toBe(reason);
  expect(fetchSpy).toHaveBeenCalledTimes(1);
  expect(await deps.store.get("run:run")).toBeUndefined();
});

test("credential acquisition failures surface without retrying the download", async () => {
  const { deps, record } = await fixture();
  const failure = new Error("Google login unavailable");
  deps.storage = gcsStorage({
    bucket: "fixture",
    signer: "fixture",
    token: async () => {
      throw failure;
    },
  });
  await expect(awaitRun(deps, record)).rejects.toBe(failure);
  expect(fetchSpy).not.toHaveBeenCalled();
});

test("a recovered log download obtains the current credentials before each attempt", async () => {
  const { deps, record } = await fixture();
  let tokens = 0;
  let downloads = 0;
  deps.storage = gcsStorage({ bucket: "fixture", signer: "fixture", token: async () => `token-${++tokens}` });
  fetchSpy.mockImplementation(async (_url, options) => {
    if (++downloads === 1) return new Response("Temporarily unavailable", { status: 503 });
    if (new Headers(options?.headers).get("Authorization") === "Bearer token-1")
      return new Response("Expired token", { status: 401 });
    return new Response("finished");
  });
  const summary = await awaitRun(deps, record);
  expect(summary).toMatchObject({ status: "passed", logPath: "run.log", tail: "finished" });
  expect(tokens).toBe(2);
  expect(fetchSpy).toHaveBeenCalledTimes(2);
});

test("local log persistence errors surface without re-downloading the log", async () => {
  const { deps, record } = await fixture();
  fetchSpy.mockImplementation(async () => new Response("finished"));
  let saves = 0;
  const failure = new Error("Local log write failed");
  deps.saveLog = async () => {
    saves++;
    throw failure;
  };
  await expect(awaitRun(deps, record)).rejects.toBe(failure);
  expect(fetchSpy).toHaveBeenCalledTimes(1);
  expect(saves).toBe(1);
});
