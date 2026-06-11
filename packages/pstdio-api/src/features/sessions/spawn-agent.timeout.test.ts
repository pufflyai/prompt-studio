import { describe, expect, mock, test } from "bun:test";
import type { EventStore, HarnessExit, TimeoutStrategy } from "pstdio-api-contracts";
import { createEventStore } from "pstdio-api-runtime-host";
import { createTestHarnessRecord, createTestHarnessRegistry, testHarnessId } from "../harnesses/test-harness-registry";
import { resumeAgentSession, spawnAgentSession } from "./spawn-agent";

const CLAUDE_CODE_ID = testHarnessId("claude-code");

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const createRegistry = (
  stop: ReturnType<typeof mock>,
  options?: { timeoutStrategy?: TimeoutStrategy; done?: Promise<HarnessExit> },
) => {
  const session = () => ({
    agentSessionId: "agent_session_1",
    done: options?.done ?? new Promise<HarnessExit>(() => {}),
    stop: stop as () => void,
    timeoutStrategy: options?.timeoutStrategy,
  });

  return createTestHarnessRegistry([
    createTestHarnessRecord("claude-code", {
      provider: {
        start: () => session(),
        resume: () => session(),
      },
    }),
  ]);
};

const createDeps = (
  eventStore: EventStore & { close(): void },
  transitionStatus: ReturnType<typeof mock>,
  remove: ReturnType<typeof mock>,
  options: {
    registry: ReturnType<typeof createTestHarnessRegistry>;
    processExitTimeoutMs?: number;
  },
) =>
  ({
    harnessRegistry: options.registry,
    eventBus: {
      emit: () => {},
    },
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
        setSession: mock(() => {}),
        remove,
      },
    },
    processExitTimeoutMs: options.processExitTimeoutMs,
  }) as unknown as Parameters<typeof spawnAgentSession>[1];

const waitForTransition = async (transitionStatus: ReturnType<typeof mock>) => {
  for (let index = 0; index < 40; index += 1) {
    if (transitionStatus.mock.calls.length > 0) return;
    await wait(10);
  }

  throw new Error("Timed out waiting for transitionStatus");
};

describe("spawnAgentSession exit timeouts", () => {
  test("stops a hung session after the timeout and marks the session as failed", async () => {
    const stop = mock(() => {});
    const transitionStatus = mock(async () => ({ id: "session_1", project_id: "project_1", status: "failed" }));
    const remove = mock(() => {});
    const eventStore = createEventStore();

    await spawnAgentSession(
      {
        sessionId: "session_1",
        agentId: CLAUDE_CODE_ID,
        prompt: "hello",
        cwd: "/repo",
      },
      createDeps(eventStore, transitionStatus, remove, {
        registry: createRegistry(stop),
        processExitTimeoutMs: 20,
      }),
    );

    await waitForTransition(transitionStatus);

    expect(stop).toHaveBeenCalledTimes(1);
    expect(transitionStatus).toHaveBeenCalledWith("session_1", "failed");
    expect(remove).toHaveBeenCalledWith("session_1");
  });

  test("resets the timeout when stream activity arrives", async () => {
    const stop = mock(() => {});
    const transitionStatus = mock(async () => ({ id: "session_1", project_id: "project_1", status: "failed" }));
    const remove = mock(() => {});
    const eventStore = createEventStore();

    await spawnAgentSession(
      {
        sessionId: "session_1",
        agentId: CLAUDE_CODE_ID,
        prompt: "hello",
        cwd: "/repo",
      },
      createDeps(eventStore, transitionStatus, remove, {
        registry: createRegistry(stop),
        processExitTimeoutMs: 20,
      }),
    );

    await wait(15);
    eventStore.push({ op: "add", path: "/messages/0", value: { role: "assistant" } });
    await wait(15);
    eventStore.push({ op: "add", path: "/messages/1", value: { role: "assistant" } });
    await wait(15);

    expect(stop).toHaveBeenCalledTimes(0);

    await waitForTransition(transitionStatus);

    expect(stop).toHaveBeenCalledTimes(1);
    expect(transitionStatus).toHaveBeenCalledWith("session_1", "failed");
  });

  test("activity-strategy resumed sessions still time out", async () => {
    const stop = mock(() => {});
    const transitionStatus = mock(async () => ({ id: "session_1", project_id: "project_1", status: "failed" }));
    const remove = mock(() => {});
    const eventStore = createEventStore();

    await resumeAgentSession(
      {
        sessionId: "session_1",
        agentSessionId: "agent_session_1",
        agentId: CLAUDE_CODE_ID,
        prompt: "continue",
        cwd: "/repo",
      },
      createDeps(eventStore, transitionStatus, remove, {
        registry: createRegistry(stop, { timeoutStrategy: "activity" }),
        processExitTimeoutMs: 20,
      }) as unknown as Parameters<typeof resumeAgentSession>[1],
    );

    await waitForTransition(transitionStatus);

    expect(stop).toHaveBeenCalledTimes(1);
    expect(transitionStatus).toHaveBeenCalledWith("session_1", "failed");
  });

  test("provider-strategy sessions do not use the activity timeout", async () => {
    const stop = mock(() => {});
    const { promise: done, resolve: resolveExit } = Promise.withResolvers<HarnessExit>();
    const transitionStatus = mock(async () => ({ id: "session_1", project_id: "project_1", status: "completed" }));
    const remove = mock(() => {});
    const eventStore = createEventStore();

    await spawnAgentSession(
      {
        sessionId: "session_1",
        agentId: CLAUDE_CODE_ID,
        prompt: "hello",
        cwd: "/repo",
      },
      createDeps(eventStore, transitionStatus, remove, {
        registry: createRegistry(stop, { timeoutStrategy: "provider", done }),
        processExitTimeoutMs: 20,
      }),
    );

    // Wait well past the timeout — the session must NOT be stopped by the host
    await wait(60);
    expect(stop).toHaveBeenCalledTimes(0);
    expect(transitionStatus).toHaveBeenCalledTimes(0);

    // Resolve the provider's exit with success
    resolveExit({ status: "completed" });
    await waitForTransition(transitionStatus);

    expect(stop).toHaveBeenCalledTimes(0);
    expect(transitionStatus).toHaveBeenCalledWith("session_1", "completed");
    expect(remove).toHaveBeenCalledWith("session_1");
  });

  test("does not time out while new events keep arriving", async () => {
    const stop = mock(() => {});
    const transitionStatus = mock(async () => ({ id: "session_1", project_id: "project_1", status: "failed" }));
    const eventStore = createEventStore();

    await spawnAgentSession(
      {
        sessionId: "session_1",
        agentId: CLAUDE_CODE_ID,
        prompt: "hello",
        cwd: "/repo",
      },
      createDeps(
        eventStore,
        transitionStatus,
        mock(() => {}),
        {
          registry: createRegistry(stop),
          processExitTimeoutMs: 25,
        },
      ),
    );

    const interval = setInterval(() => {
      eventStore.push({ op: "add", path: "/messages/live", value: Date.now() });
    }, 10);

    await wait(90);
    clearInterval(interval);

    expect(stop).toHaveBeenCalledTimes(0);
    expect(transitionStatus).toHaveBeenCalledTimes(0);
  });
});
