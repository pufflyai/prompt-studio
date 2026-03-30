import { describe, expect, mock, test } from "bun:test";
import type { AgentService } from "pstdio-agents";
import { resumeAgentSession, spawnAgentSession } from "./spawn-agent";

const buildAgent = () => {
  const getMessages = mock(async () => [
    { id: "m1", role: "user", parts: [{ type: "text", text: "hello" }] },
    { id: "m2", role: "assistant", parts: [{ type: "text", text: "hi" }] },
    { id: "m3", role: "user", parts: [{ type: "text", text: "continue" }] },
  ]);
  const resumeSession = mock(async (_input: unknown, _eventStore: unknown, _approvalService?: unknown) => ({}));

  const agent = {
    id: "claude-code",
    name: "Claude Code",
    capabilities: () => [],
    checkAvailability: () => ({ type: "NOT_FOUND" }),
    listModels: () => [],
    startSession: async () => ({}),
    resumeSession,
    getMessages,
    listSessions: async () => [],
    exportSession: async () => ({ session: { id: "s1", title: "title" }, messages: [] }),
    launchSession: async () => ({}),
  } as unknown as AgentService;

  return { agent, getMessages, resumeSession };
};

describe("resumeAgentSession", () => {
  test("uses existing message count as default messageOffset", async () => {
    const { agent, getMessages, resumeSession } = buildAgent();
    const storeEntries = new Map<string, unknown>();
    const sessionService = {
      update: async () => null,
      transitionStatus: async () => null,
      store: {
        create: mock((id: string) => {
          const entry = {
            eventStore: { push: () => {}, getHistory: () => [] },
            approvalService: { handleResponse: () => {} },
          };
          storeEntries.set(id, entry);
          return entry;
        }),
        get: mock((id: string) => storeEntries.get(id) ?? null),
        setProcess: mock(() => {}),
        remove: mock(() => {}),
      },
    };

    await resumeAgentSession(
      {
        sessionId: "s_1",
        agentSessionId: "agent_1",
        agentId: "claude-code",
        prompt: "continue",
        cwd: "/repo",
      },
      {
        agentRegistry: {
          get: () => agent,
          list: () => [],
          checkAll: () => ({
            "claude-code": { type: "INSTALLED" },
            opencode: { type: "INSTALLED" },
            fake: { type: "INSTALLED" },
          }),
        },
        sessionService,
        eventBus: {
          emit: () => {},
        },
      } as unknown as Parameters<typeof resumeAgentSession>[1],
    );

    expect(getMessages).toHaveBeenCalledWith("agent_1", { cwd: "/repo" });
    expect(resumeSession).toHaveBeenCalledTimes(1);

    const firstCall = resumeSession.mock.calls[0];
    const resumeInput = firstCall?.[0] as { messageOffset?: number } | undefined;
    expect(resumeInput?.messageOffset).toBe(3);
  });

  test("creates the stream entry before waiting for message history", async () => {
    let resolveMessages!: (messages: unknown[]) => void;
    const pendingMessages = new Promise<unknown[]>((resolve) => {
      resolveMessages = resolve;
    });
    const getMessages = mock(() => pendingMessages);
    const resumeSession = mock(async (_input: unknown, _eventStore: unknown, _approvalService?: unknown) => ({}));

    const agent = {
      id: "claude-code",
      name: "Claude Code",
      capabilities: () => [],
      checkAvailability: () => ({ type: "NOT_FOUND" }),
      listModels: () => [],
      startSession: async () => ({}),
      resumeSession,
      getMessages,
      listSessions: async () => [],
      exportSession: async () => ({ session: { id: "s1", title: "title" }, messages: [] }),
      launchSession: async () => ({}),
    } as unknown as AgentService;

    const storeEntries = new Map<string, unknown>();
    const sessionService = {
      update: async () => null,
      transitionStatus: async () => null,
      store: {
        create: mock((id: string) => {
          const entry = {
            eventStore: { push: () => {}, getHistory: () => [] },
            approvalService: { handleResponse: () => {} },
          };
          storeEntries.set(id, entry);
          return entry;
        }),
        get: mock((id: string) => storeEntries.get(id) ?? null),
        setProcess: mock(() => {}),
        remove: mock(() => {}),
      },
    };
    const resumePromise = resumeAgentSession(
      {
        sessionId: "s_1",
        agentSessionId: "agent_1",
        agentId: "claude-code",
        prompt: "continue",
        cwd: "/repo",
      },
      {
        agentRegistry: {
          get: () => agent,
          list: () => [],
          checkAll: () => ({
            "claude-code": { type: "INSTALLED" },
            opencode: { type: "INSTALLED" },
            fake: { type: "INSTALLED" },
          }),
        },
        sessionService,
        eventBus: {
          emit: () => {},
        },
      } as unknown as Parameters<typeof resumeAgentSession>[1],
    );

    expect(sessionService.store.create).toHaveBeenCalledTimes(1);

    resolveMessages([
      { id: "m1", role: "user", parts: [{ type: "text", text: "hello" }] },
      { id: "m2", role: "assistant", parts: [{ type: "text", text: "hi" }] },
    ]);
    await resumePromise;

    expect(resumeSession).toHaveBeenCalledTimes(1);
  });
});

describe("spawnAgentSession", () => {
  test("fires status hooks when the spawned process exits", async () => {
    const startSession = mock(async () => ({
      sessionId: "agent_session_1",
      process: {
        onExit: Promise.resolve({ code: 0, signal: null }),
      },
    }));

    const agent = {
      id: "claude-code",
      name: "Claude Code",
      capabilities: () => [],
      checkAvailability: () => ({ type: "NOT_FOUND" }),
      listModels: () => [],
      startSession,
      resumeSession: async () => ({}),
      getMessages: async () => [],
      listSessions: async () => [],
      exportSession: async () => ({ session: { id: "s1", title: "title" }, messages: [] }),
      launchSession: async () => ({}),
    } as unknown as AgentService;

    const transitionStatus = mock(async () => ({ id: "session_1", project_id: "project_1", status: "completed" }));

    await spawnAgentSession(
      {
        sessionId: "session_1",
        agentId: "claude-code",
        prompt: "hello",
        cwd: "/repo",
      },
      {
        agentRegistry: {
          get: () => agent,
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
          update: async () => null,
          transitionStatus,
          store: {
            create: mock(() => ({
              eventStore: { push: () => {}, getHistory: () => [] },
              approvalService: { handleResponse: () => {} },
            })),
            get: mock(() => null),
            setProcess: mock(() => {}),
            remove: mock(() => {}),
          },
        },
      } as unknown as Parameters<typeof spawnAgentSession>[1],
    );

    for (let index = 0; index < 20; index += 1) {
      if (transitionStatus.mock.calls.length > 0) break;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    expect(transitionStatus).toHaveBeenCalledWith("session_1", "completed");
  });
});
