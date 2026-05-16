import { describe, expect, mock, test } from "bun:test";
import { type AgentService, createEventStore } from "pstdio-agents";
import { spawnAgentSession } from "./spawn-agent";

const createStoreEntry = () => ({
  eventStore: createEventStore(),
  approvalService: { handleResponse: () => {}, dispose: () => {} },
});

describe("spawnAgentSession lifecycle", () => {
  test("keeps the follow-up store entry created during terminal drain", async () => {
    const exit = Promise.withResolvers<{ code: number | null; signal: string | null }>();
    const startSession = mock(async () => ({
      sessionId: "agent_session_1",
      process: { onExit: exit.promise },
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

    const storeEntries = new Map<string, ReturnType<typeof createStoreEntry>>();
    const remove = mock((id: string) => {
      storeEntries.delete(id);
    });
    const transitionStatus = mock(async () => {
      storeEntries.set("session_1", createStoreEntry());
      return { id: "session_1", project_id: "project_1", status: "completed" };
    });

    await spawnAgentSession({ sessionId: "session_1", agentId: "claude-code", prompt: "hello", cwd: "/repo" }, {
      agentRegistry: {
        get: () => agent,
        list: () => [],
        checkAll: () => ({
          "claude-code": { type: "INSTALLED" },
          opencode: { type: "INSTALLED" },
          fake: { type: "INSTALLED" },
        }),
      },
      eventBus: { emit: () => {} },
      fileService: {
        get: async () => null,
        upload: async () => ({ id: "file_1" }),
        update: async () => null,
      },
      sessionService: {
        get: mock(async () => ({ id: "session_1", project_id: "project_1", status: "in_progress" })),
        update: async () => null,
        transitionStatus,
        store: {
          create: mock((id: string) => {
            const entry = createStoreEntry();
            storeEntries.set(id, entry);
            return entry;
          }),
          get: mock((id: string) => storeEntries.get(id) ?? null),
          setProcess: mock(() => {}),
          remove,
        },
      },
    } as unknown as Parameters<typeof spawnAgentSession>[1]);

    exit.resolve({ code: 0, signal: null });

    for (let index = 0; index < 20; index += 1) {
      if (transitionStatus.mock.calls.length > 0) break;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    expect(remove).toHaveBeenCalledWith("session_1");
    expect(transitionStatus).toHaveBeenCalledWith("session_1", "completed");
    expect(storeEntries.has("session_1")).toBe(true);
  });
});
