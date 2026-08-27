import { describe, expect, mock, test } from "bun:test";
import type { EventStore, HarnessExit } from "pstdio-api-contracts";
import { createEventStore } from "pstdio-api-runtime-host";
import { createTestHarnessRecord, createTestHarnessRegistry, testHarnessId } from "../harnesses/test-harness-registry";
import { spawnAgentSession } from "./spawn-agent";

const OPENCODE_ID = testHarnessId("opencode");

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// OpenCode self-terminates (timeoutStrategy "provider"), so the host must trust
// `done` instead of failing quiet sessions through the activity watchdog.
const createOpencodeRegistry = (done: Promise<HarnessExit>) =>
  createTestHarnessRegistry([
    createTestHarnessRecord("opencode", {
      provider: {
        start: () => ({
          agentSessionId: "oc_session_1",
          done,
          stop: () => {},
          timeoutStrategy: "provider",
        }),
      },
    }),
  ]);

const createDeps = (
  eventStore: EventStore & { close(): void },
  transitionStatus: ReturnType<typeof mock>,
  remove: ReturnType<typeof mock>,
  registry: ReturnType<typeof createTestHarnessRegistry>,
  options?: { processExitTimeoutMs?: number },
) =>
  ({
    harnessRegistry: registry,
    eventBus: { emit: () => {} },
    fileService: {
      get: async () => null,
      upload: async () => ({ id: "file_1" }),
      update: async () => null,
    },
    sessionService: {
      get: async () => null,
      update: async () => null,
      transitionStatus,
      store: {
        create: mock(() => ({
          eventStore,
          approvalService: { handleResponse: () => {}, dispose: () => {} },
        })),
        get: mock(() => ({
          eventStore,
          approvalService: { handleResponse: () => {}, dispose: () => {} },
        })),
        setSession: mock(() => true),
        remove,
      },
    },
    processExitTimeoutMs: options?.processExitTimeoutMs,
  }) as unknown as Parameters<typeof spawnAgentSession>[1];

describe("OpenCode session timeout repro", () => {
  test("quiet OpenCode session does not fail while daemon is still processing", async () => {
    const { promise: done, resolve: resolveExit } = Promise.withResolvers<HarnessExit>();
    const transitionStatus = mock(async () => ({ id: "session_1", project_id: "project_1", status: "completed" }));
    const remove = mock(() => {});
    const eventStore = createEventStore();

    await spawnAgentSession(
      {
        sessionId: "session_1",
        agentId: OPENCODE_ID,
        prompt: "hello",
        cwd: "/repo",
      },
      createDeps(eventStore, transitionStatus, remove, createOpencodeRegistry(done), { processExitTimeoutMs: 20 }),
    );

    // No EventStore patches arrive — simulates a long OpenCode tool call
    await wait(60);

    // Session must NOT be marked failed
    expect(transitionStatus).toHaveBeenCalledTimes(0);

    // Provider eventually completes
    resolveExit({ status: "completed" });

    for (let i = 0; i < 40; i++) {
      if (transitionStatus.mock.calls.length > 0) break;
      await wait(10);
    }

    expect(transitionStatus).toHaveBeenCalledWith("session_1", "completed");
    expect(remove).toHaveBeenCalledWith("session_1");
  });

  test("resumed OpenCode session does not re-fail under quiet condition", async () => {
    const { promise: done, resolve: resolveExit } = Promise.withResolvers<HarnessExit>();
    const transitionStatus = mock(async () => ({ id: "session_1", project_id: "project_1", status: "completed" }));
    const remove = mock(() => {});
    const eventStore = createEventStore();

    await spawnAgentSession(
      {
        sessionId: "session_1",
        agentId: OPENCODE_ID,
        prompt: "resumed follow-up",
        cwd: "/repo",
      },
      createDeps(eventStore, transitionStatus, remove, createOpencodeRegistry(done), { processExitTimeoutMs: 20 }),
    );

    // No patches at all — same quiet condition that previously caused false failure
    await wait(60);

    expect(transitionStatus).toHaveBeenCalledTimes(0);

    resolveExit({ status: "completed" });

    for (let i = 0; i < 40; i++) {
      if (transitionStatus.mock.calls.length > 0) break;
      await wait(10);
    }

    expect(transitionStatus).toHaveBeenCalledWith("session_1", "completed");
  });

  test("POST timeout transitions API session to disconnected, not completed or failed", async () => {
    const { promise: done, resolve: resolveExit } = Promise.withResolvers<HarnessExit>();
    const transitionStatus = mock(async () => ({
      id: "session_1",
      project_id: "project_1",
      status: "disconnected",
    }));
    const remove = mock(() => {});
    const eventStore = createEventStore();

    await spawnAgentSession(
      {
        sessionId: "session_1",
        agentId: OPENCODE_ID,
        prompt: "hello",
        cwd: "/repo",
      },
      createDeps(eventStore, transitionStatus, remove, createOpencodeRegistry(done), { processExitTimeoutMs: 20 }),
    );

    // Simulate the provider signaling a POST timeout
    resolveExit({ status: "disconnected" });

    for (let i = 0; i < 40; i++) {
      if (transitionStatus.mock.calls.length > 0) break;
      await wait(10);
    }

    expect(transitionStatus).toHaveBeenCalledWith("session_1", "disconnected");
    expect(remove).toHaveBeenCalledWith("session_1");
  });
});
