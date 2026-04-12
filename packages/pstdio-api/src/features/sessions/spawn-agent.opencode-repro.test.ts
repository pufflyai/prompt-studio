import { describe, expect, mock, test } from "bun:test";
import { Writable } from "node:stream";
import { type AgentService, createEventStore, type EventStore } from "pstdio-agents";
import { spawnAgentSession } from "./spawn-agent";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const createWritable = () =>
  new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  });

const createOpencodeAgent = (onExit: Promise<{ code: number | null; signal: string | null }>) =>
  ({
    id: "opencode",
    name: "OpenCode",
    capabilities: () => [],
    checkAvailability: () => ({ type: "INSTALLED" }),
    listModels: () => [],
    startSession: async () => ({
      sessionId: "oc_session_1",
      process: {
        sessionId: "oc_session_1",
        stdin: createWritable(),
        kill: () => {},
        onExit,
        timeoutStrategy: "provider",
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
  agent: AgentService,
  options?: { processExitTimeoutMs?: number },
) =>
  ({
    agentRegistry: {
      get: () => agent,
      list: () => [],
      checkAll: () => ({}),
    },
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
        setProcess: mock(() => {}),
        remove,
      },
    },
    processExitTimeoutMs: options?.processExitTimeoutMs,
  }) as unknown as Parameters<typeof spawnAgentSession>[1];

describe("OpenCode session timeout repro", () => {
  test("quiet OpenCode session does not fail while daemon is still processing", async () => {
    const { promise: onExit, resolve: resolveExit } = Promise.withResolvers<{
      code: number | null;
      signal: string | null;
    }>();
    const agent = createOpencodeAgent(onExit);
    const transitionStatus = mock(async () => ({ id: "session_1", project_id: "project_1", status: "completed" }));
    const remove = mock(() => {});
    const eventStore = createEventStore();

    await spawnAgentSession(
      {
        sessionId: "session_1",
        agentId: "opencode",
        prompt: "hello",
        cwd: "/repo",
      },
      createDeps(eventStore, transitionStatus, remove, agent, { processExitTimeoutMs: 20 }),
    );

    // No EventStore patches arrive — simulates a long OpenCode tool call
    await wait(60);

    // Session must NOT be marked failed
    expect(transitionStatus).toHaveBeenCalledTimes(0);

    // Provider eventually completes
    resolveExit({ code: 0, signal: null });

    for (let i = 0; i < 40; i++) {
      if (transitionStatus.mock.calls.length > 0) break;
      await wait(10);
    }

    expect(transitionStatus).toHaveBeenCalledWith("session_1", "completed");
    expect(remove).toHaveBeenCalledWith("session_1");
  });

  test("resumed OpenCode session does not re-fail under quiet condition", async () => {
    const { promise: onExit, resolve: resolveExit } = Promise.withResolvers<{
      code: number | null;
      signal: string | null;
    }>();
    const agent = createOpencodeAgent(onExit);
    const transitionStatus = mock(async () => ({ id: "session_1", project_id: "project_1", status: "completed" }));
    const remove = mock(() => {});
    const eventStore = createEventStore();

    await spawnAgentSession(
      {
        sessionId: "session_1",
        agentId: "opencode",
        prompt: "resumed follow-up",
        cwd: "/repo",
      },
      createDeps(eventStore, transitionStatus, remove, agent, { processExitTimeoutMs: 20 }),
    );

    // No patches at all — same quiet condition that previously caused false failure
    await wait(60);

    expect(transitionStatus).toHaveBeenCalledTimes(0);

    resolveExit({ code: 0, signal: null });

    for (let i = 0; i < 40; i++) {
      if (transitionStatus.mock.calls.length > 0) break;
      await wait(10);
    }

    expect(transitionStatus).toHaveBeenCalledWith("session_1", "completed");
  });

  test("POST timeout transitions API session to disconnected, not completed or failed", async () => {
    const { promise: onExit, resolve: resolveExit } = Promise.withResolvers<{
      code: number | null;
      signal: string | null;
    }>();
    const agent = createOpencodeAgent(onExit);
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
        agentId: "opencode",
        prompt: "hello",
        cwd: "/repo",
      },
      createDeps(eventStore, transitionStatus, remove, agent, { processExitTimeoutMs: 20 }),
    );

    // Simulate the provider signaling a POST timeout
    resolveExit({ code: null, signal: "TIMEOUT" });

    for (let i = 0; i < 40; i++) {
      if (transitionStatus.mock.calls.length > 0) break;
      await wait(10);
    }

    expect(transitionStatus).toHaveBeenCalledWith("session_1", "disconnected");
    expect(remove).toHaveBeenCalledWith("session_1");
  });
});
