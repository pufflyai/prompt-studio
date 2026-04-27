import { describe, expect, mock, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import type { AgentService, EventStore, SessionMessageInput, SessionStartInput, SpawnedProcess } from "pstdio-agents";
import { createApp } from "../../../app";

type Deferred<T> = {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(reason?: unknown): void;
};

const createDeferred = <T>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
};

const createControlledProcess = (
  sessionId: string,
  exit: Deferred<{ code: number | null; signal: string | null }>,
  onKill: () => void,
): SpawnedProcess => {
  let settled = false;
  const onExit = exit.promise.then((value) => {
    settled = true;
    return value;
  });

  return {
    sessionId,
    stdin: new PassThrough(),
    kill: () => {
      onKill();
      if (!settled) exit.resolve({ code: null, signal: "SIGTERM" });
    },
    onExit,
  };
};

const pushTextPair = (eventStore: EventStore | undefined, sessionId: string, prompt: string, offset: number) => {
  eventStore?.push({
    op: "add",
    path: `/messages/${offset}`,
    value: { id: `${sessionId}-${offset}`, role: "user", parts: [{ type: "text", text: prompt }], index: offset },
  });
  eventStore?.push({
    op: "add",
    path: `/messages/${offset + 1}`,
    value: {
      id: `${sessionId}-${offset + 1}`,
      role: "assistant",
      parts: [{ type: "text", text: `done: ${prompt}` }],
      index: offset + 1,
    },
  });
};

const createHarnessAgent = (
  kill: ReturnType<typeof mock>,
  exits: Deferred<{ code: number | null; signal: string | null }>[],
) =>
  ({
    id: "fake",
    name: "Fake Harness",
    capabilities: () => [],
    checkAvailability: () => ({ type: "INSTALLED" }),
    listModels: () => [{ id: "fake" }],
    startSession: async (input: SessionStartInput) => {
      const exit = createDeferred<{ code: number | null; signal: string | null }>();
      exits.push(exit);
      pushTextPair(input.eventStore, "fake-run-1", input.prompt, 0);
      return {
        sessionId: "fake-run-1",
        process: createControlledProcess("fake-run-1", exit, kill),
      };
    },
    resumeSession: async (input: SessionMessageInput, eventStore: EventStore) => {
      const exit = createDeferred<{ code: number | null; signal: string | null }>();
      exits.push(exit);
      pushTextPair(eventStore, input.sessionId, input.prompt, input.messageOffset ?? 0);
      return {
        process: createControlledProcess(input.sessionId, exit, kill),
      };
    },
    getMessages: async () => [],
    listSessions: async () => [],
    exportSession: async (sessionId: string) => ({
      session: { id: sessionId, title: "Fake Harness", directory: process.cwd(), updatedAt: new Date().toISOString() },
      messages: [],
    }),
    launchSession: async () => ({}),
  }) as AgentService;

const waitForSessionStatus = async (
  app: Awaited<ReturnType<typeof createApp>>["app"],
  sessionId: string,
  expectedStatus: string,
) => {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const response = await app.request(`/v1/sessions/${sessionId}`);
    expect(response.status).toBe(200);
    const session = await response.json();
    if (session.status === expectedStatus) return session;
    await Bun.sleep(20);
  }

  throw new Error(`Session ${sessionId} did not reach status ${expectedStatus}`);
};

const waitForSessionStoreRemoval = (
  sessionService: Awaited<ReturnType<typeof createApp>>["deps"]["sessionService"],
  sessionId: string,
) => {
  const { promise, resolve } = Promise.withResolvers<void>();
  const originalRemove = sessionService.store.remove;

  sessionService.store.remove = (removedSessionId: string) => {
    originalRemove(removedSessionId);
    if (removedSessionId === sessionId) resolve();
  };

  if (!sessionService.store.get(sessionId)) resolve();

  return Promise.race([
    promise,
    Bun.sleep(500).then(() => {
      throw new Error("Timed out waiting for session store cleanup");
    }),
  ]);
};

describe("harness session ingress", () => {
  test("starts, sends to, and stops a first-party harness-backed session", async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-harness-session-test-"));
    const exits: Deferred<{ code: number | null; signal: string | null }>[] = [];
    const kill = mock(() => {});
    const handle = await createApp({
      dbPath: ":memory:",
      storagePath: join(tempRoot, "storage"),
      filesRoot: "",
      agents: [createHarnessAgent(kill, exits)],
    });

    try {
      const infoResponse = await handle.app.request("/v1/harnesses/info");
      expect(infoResponse.status).toBe(200);
      expect(await infoResponse.json()).toEqual([
        {
          id: "pstdio.harness.fake",
          name: "Fake Harness",
          extension_id: "pstdio.harness.fake",
          availability: { type: "INSTALLED" },
        },
      ]);

      const setupResponse = await handle.app.request("/v1/harnesses", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ harness_id: "pstdio.harness.fake" }),
      });
      expect(setupResponse.status).toBe(201);
      expect(await setupResponse.json()).toMatchObject({
        harness_id: "pstdio.harness.fake",
        is_default: true,
      });

      const modelsResponse = await handle.app.request("/v1/harnesses/pstdio.harness.fake/models");
      expect(modelsResponse.status).toBe(200);
      expect(await modelsResponse.json()).toEqual([{ id: "fake" }]);

      const projectResponse = await handle.app.request("/v1/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Harness Project", agents: ["fake"] }),
      });
      expect(projectResponse.status).toBe(201);
      const project = await projectResponse.json();

      const startResponse = await handle.app.request("/v1/harnesses/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          project_id: project.id,
          title: "Harness start",
          prompt: "start",
        }),
      });
      expect(startResponse.status).toBe(201);
      const session = await startResponse.json();
      expect(session.agent).toBe("pstdio.harness.fake");
      expect(exits).toHaveLength(1);

      exits[0]!.resolve({ code: 0, signal: null });
      await waitForSessionStatus(handle.app, session.id, "completed");

      const sendResponse = await handle.app.request(`/v1/harnesses/sessions/${session.id}/send`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: "follow-up" }),
      });
      expect(sendResponse.status).toBe(200);
      expect(await sendResponse.json()).toMatchObject({ id: session.id, agent: "pstdio.harness.fake" });
      expect(exits).toHaveLength(2);

      const storeRemoved = waitForSessionStoreRemoval(handle.deps.sessionService, session.id);
      const stopResponse = await handle.app.request(`/v1/harnesses/sessions/${session.id}/stop`, {
        method: "POST",
      });
      expect(stopResponse.status).toBe(200);
      expect(await stopResponse.json()).toMatchObject({ id: session.id, status: "cancelled" });
      expect(kill).toHaveBeenCalled();

      const finalSession = await waitForSessionStatus(handle.app, session.id, "cancelled");
      await storeRemoved;
      expect(finalSession.agent).toBe("pstdio.harness.fake");
    } finally {
      await handle.close();
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
