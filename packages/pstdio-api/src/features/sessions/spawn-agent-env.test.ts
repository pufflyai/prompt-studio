import { describe, expect, mock, test } from "bun:test";
import { type AgentService, createEventStore } from "pstdio-agents";
import { resumeAgentSession, spawnAgentSession } from "./spawn-agent";

const createStoreEntry = () => ({
  eventStore: createEventStore(),
  approvalService: { handleResponse: () => {}, dispose: () => {} },
});

const checkAll = () => ({
  "claude-code": { type: "INSTALLED" },
  opencode: { type: "INSTALLED" },
  fake: { type: "INSTALLED" },
});

const createAgent = (overrides: Partial<AgentService>) =>
  ({
    id: "claude-code",
    name: "Claude Code",
    capabilities: () => [],
    checkAvailability: () => ({ type: "NOT_FOUND" }),
    listModels: () => [],
    startSession: async () => ({}),
    resumeSession: async () => ({}),
    getMessages: async () => [],
    listSessions: async () => [],
    exportSession: async () => ({ session: { id: "s1", title: "title" }, messages: [] }),
    launchSession: async () => ({}),
    ...overrides,
  }) as unknown as AgentService;

const createRegistry = (agent: AgentService) => ({
  get: () => agent,
  list: () => [],
  checkAll,
});

const createSessionService = () => {
  const storeEntries = new Map<string, unknown>();
  return {
    get: mock(async () => ({ id: "session_99", project_id: "project_1", status: "in_progress" })),
    update: async () => null,
    transitionStatus: async () => null,
    store: {
      create: mock((id: string) => {
        const entry = createStoreEntry();
        storeEntries.set(id, entry);
        return entry;
      }),
      get: mock((id: string) => storeEntries.get(id) ?? null),
      setProcess: mock(() => {}),
      remove: mock(() => {}),
    },
  };
};

describe("spawnAgentSession environment", () => {
  test("passes pstdio ids to started agent sessions", async () => {
    const startSession = mock(async (_input: unknown) => ({ sessionId: "agent_session_1" }));
    const agent = createAgent({ startSession });

    await spawnAgentSession(
      {
        sessionId: "session_99",
        projectId: "project_99",
        agentId: "claude-code",
        prompt: "hello",
      },
      {
        agentRegistry: createRegistry(agent),
        eventBus: { emit: () => {} },
        fileService: {
          get: async () => null,
          upload: async () => ({ id: "file_1" }),
          update: async () => null,
        },
        sessionService: createSessionService(),
      } as unknown as Parameters<typeof spawnAgentSession>[1],
    );

    const startInput = startSession.mock.calls[0]?.[0] as { env?: Record<string, string> } | undefined;
    expect(startInput?.env).toMatchObject({
      PSTDIO_PROJECT_ID: "project_99",
      PSTDIO_SESSION_ID: "session_99",
    });
  });

  test("passes pstdio ids to resumed agent sessions", async () => {
    const resumeSession = mock(async (_input: unknown, _eventStore: unknown, _approvalService?: unknown) => ({}));
    const agent = createAgent({ resumeSession });

    await resumeAgentSession(
      {
        sessionId: "s_42",
        projectId: "project_42",
        agentSessionId: "agent_1",
        agentId: "claude-code",
        prompt: "continue",
      },
      {
        agentRegistry: createRegistry(agent),
        sessionService: createSessionService(),
        eventBus: { emit: () => {} },
      } as unknown as Parameters<typeof resumeAgentSession>[1],
    );

    const resumeInput = resumeSession.mock.calls[0]?.[0] as { env?: Record<string, string> } | undefined;
    expect(resumeInput?.env).toMatchObject({
      PSTDIO_PROJECT_ID: "project_42",
      PSTDIO_SESSION_ID: "s_42",
    });
  });
});
