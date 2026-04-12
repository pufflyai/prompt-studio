import { describe, expect, mock, test } from "bun:test";
import { Writable } from "node:stream";
import { type AgentService, createEventStore, type EventStore, type TimeoutStrategy } from "pstdio-agents";
import { spawnAgentSession } from "./spawn-agent";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const createWritable = () =>
  new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  });

const createAgent = (
  kill: ReturnType<typeof mock>,
  options?: { timeoutStrategy?: TimeoutStrategy; onExit?: Promise<{ code: number | null; signal: string | null }> },
) =>
  ({
    id: "claude-code",
    name: "Claude Code",
    capabilities: () => [],
    checkAvailability: () => ({ type: "NOT_FOUND" }),
    listModels: () => [],
    startSession: async () => ({
      sessionId: "agent_session_1",
      process: {
        sessionId: "agent_session_1",
        stdin: createWritable(),
        kill,
        onExit: options?.onExit ?? new Promise<{ code: number | null; signal: string | null }>(() => {}),
        timeoutStrategy: options?.timeoutStrategy,
      },
    }),
    resumeSession: async () => ({}),
    getMessages: async () => [],
    listSessions: async () => [],
    exportSession: async () => ({ session: { id: "s1", title: "title" }, messages: [] }),
    launchSession: async () => ({}),
  }) as unknown as AgentService;

const createDeps = (
  eventStore: EventStore & { close(): void },
  transitionStatus: ReturnType<typeof mock>,
  remove: ReturnType<typeof mock>,
  options?: {
    processExitTimeoutMs?: number;
    agent?: AgentService;
  },
) =>
  ({
    agentRegistry: {
      get: () => options?.agent ?? createAgent(mock(() => {})),
      list: () => [],
      checkAll: () => ({
        "claude-code": { type: "INSTALLED" },
        opencode: { type: "INSTALLED" },
        fake: { type: "INSTALLED" },
      }),
    },
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
        setProcess: mock(() => {}),
        remove,
      },
    },
    processExitTimeoutMs: options?.processExitTimeoutMs,
  }) as unknown as Parameters<typeof spawnAgentSession>[1];

const waitForTransition = async (transitionStatus: ReturnType<typeof mock>) => {
  for (let index = 0; index < 40; index += 1) {
    if (transitionStatus.mock.calls.length > 0) return;
    await wait(10);
  }

  throw new Error("Timed out waiting for transitionStatus");
};

describe("spawnAgentSession process exit timeouts", () => {
  test("kills a hung process after the timeout and marks the session as failed", async () => {
    const kill = mock(() => {});
    const agent = createAgent(kill);
    const transitionStatus = mock(async () => ({ id: "session_1", project_id: "project_1", status: "failed" }));
    const remove = mock(() => {});
    const eventStore = createEventStore();

    await spawnAgentSession(
      {
        sessionId: "session_1",
        agentId: "claude-code",
        prompt: "hello",
        cwd: "/repo",
      },
      createDeps(eventStore, transitionStatus, remove, {
        agent,
        processExitTimeoutMs: 20,
      }),
    );

    await waitForTransition(transitionStatus);

    expect(kill).toHaveBeenCalledTimes(1);
    expect(transitionStatus).toHaveBeenCalledWith("session_1", "failed");
    expect(remove).toHaveBeenCalledWith("session_1");
  });

  test("resets the timeout when stream activity arrives", async () => {
    const kill = mock(() => {});
    const agent = createAgent(kill);
    const transitionStatus = mock(async () => ({ id: "session_1", project_id: "project_1", status: "failed" }));
    const remove = mock(() => {});
    const eventStore = createEventStore();

    await spawnAgentSession(
      {
        sessionId: "session_1",
        agentId: "claude-code",
        prompt: "hello",
        cwd: "/repo",
      },
      createDeps(eventStore, transitionStatus, remove, {
        agent,
        processExitTimeoutMs: 20,
      }),
    );

    await wait(15);
    eventStore.push({ op: "add", path: "/messages/0", value: { role: "assistant" } });
    await wait(15);
    eventStore.push({ op: "add", path: "/messages/1", value: { role: "assistant" } });
    await wait(15);

    expect(kill).toHaveBeenCalledTimes(0);

    await waitForTransition(transitionStatus);

    expect(kill).toHaveBeenCalledTimes(1);
    expect(transitionStatus).toHaveBeenCalledWith("session_1", "failed");
  });

  test("activity-strategy processes still time out", async () => {
    const kill = mock(() => {});
    const agent = createAgent(kill, { timeoutStrategy: "activity" });
    const transitionStatus = mock(async () => ({ id: "session_1", project_id: "project_1", status: "failed" }));
    const remove = mock(() => {});
    const eventStore = createEventStore();

    await spawnAgentSession(
      {
        sessionId: "session_1",
        agentId: "claude-code",
        prompt: "hello",
        cwd: "/repo",
      },
      createDeps(eventStore, transitionStatus, remove, {
        agent,
        processExitTimeoutMs: 20,
      }),
    );

    await waitForTransition(transitionStatus);

    expect(kill).toHaveBeenCalledTimes(1);
    expect(transitionStatus).toHaveBeenCalledWith("session_1", "failed");
  });

  test("provider-strategy processes do not use activity timeout", async () => {
    const kill = mock(() => {});
    const { promise: onExit, resolve: resolveExit } = Promise.withResolvers<{
      code: number | null;
      signal: string | null;
    }>();
    const agent = createAgent(kill, { timeoutStrategy: "provider", onExit });
    const transitionStatus = mock(async () => ({ id: "session_1", project_id: "project_1", status: "completed" }));
    const remove = mock(() => {});
    const eventStore = createEventStore();

    await spawnAgentSession(
      {
        sessionId: "session_1",
        agentId: "claude-code",
        prompt: "hello",
        cwd: "/repo",
      },
      createDeps(eventStore, transitionStatus, remove, {
        agent,
        processExitTimeoutMs: 20,
      }),
    );

    // Wait well past the timeout — process should NOT be killed
    await wait(60);
    expect(kill).toHaveBeenCalledTimes(0);
    expect(transitionStatus).toHaveBeenCalledTimes(0);

    // Resolve the provider's onExit with success
    resolveExit({ code: 0, signal: null });
    await waitForTransition(transitionStatus);

    expect(kill).toHaveBeenCalledTimes(0);
    expect(transitionStatus).toHaveBeenCalledWith("session_1", "completed");
    expect(remove).toHaveBeenCalledWith("session_1");
  });

  test("does not time out while new events keep arriving", async () => {
    const kill = mock(() => {});
    const agent = createAgent(kill);
    const transitionStatus = mock(async () => ({ id: "session_1", project_id: "project_1", status: "failed" }));
    const eventStore = createEventStore();

    await spawnAgentSession(
      {
        sessionId: "session_1",
        agentId: "claude-code",
        prompt: "hello",
        cwd: "/repo",
      },
      createDeps(
        eventStore,
        transitionStatus,
        mock(() => {}),
        {
          agent,
          processExitTimeoutMs: 25,
        },
      ),
    );

    const interval = setInterval(() => {
      eventStore.push({ op: "add", path: "/messages/live", value: Date.now() });
    }, 10);

    await wait(90);
    clearInterval(interval);

    expect(kill).toHaveBeenCalledTimes(0);
    expect(transitionStatus).toHaveBeenCalledTimes(0);
  });
});
