import { describe, expect, mock, test } from "bun:test";
import type { HarnessSession } from "pstdio-api-contracts";
import { createEventStore } from "pstdio-api-runtime-host";
import { createTestHarnessRecord, createTestHarnessRegistry, testHarnessId } from "../harnesses/test-harness-registry";
import { resumeAgentSession, spawnAgentSession } from "./spawn-agent";

const CLAUDE_CODE_ID = testHarnessId("claude-code");

const createStoreEntry = () => ({
  eventStore: createEventStore(),
  approvalService: { handleResponse: () => {}, dispose: () => {} },
});

const completedSession = (): HarnessSession => ({
  agentSessionId: "agent_session_1",
  done: Promise.resolve({ status: "completed" }),
  stop: () => {},
});

const buildHarness = () => {
  const getMessages = mock(async () => [
    { id: "m1", role: "user" as const, parts: [{ type: "text" as const, text: "hello" }] },
    { id: "m2", role: "assistant" as const, parts: [{ type: "text" as const, text: "hi" }] },
    { id: "m3", role: "user" as const, parts: [{ type: "text" as const, text: "continue" }] },
  ]);
  const resume = mock((_ctx: unknown, _input: unknown) => completedSession());

  const registry = createTestHarnessRegistry([
    createTestHarnessRecord("claude-code", { provider: { getMessages, resume } }),
  ]);

  return { registry, getMessages, resume };
};

const createSessionServiceMock = () => {
  const storeEntries = new Map<string, unknown>();
  return {
    get: mock(async () => null),
    update: async () => null,
    transitionStatus: async () => null,
    store: {
      create: mock((id: string) => {
        const entry = createStoreEntry();
        storeEntries.set(id, entry);
        return entry;
      }),
      get: mock((id: string) => storeEntries.get(id) ?? null),
      setSession: mock(() => {}),
      remove: mock(() => {}),
    },
  };
};

describe("resumeAgentSession", () => {
  test("uses existing message count as default messageOffset", async () => {
    const { registry, getMessages, resume } = buildHarness();
    const sessionService = createSessionServiceMock();

    await resumeAgentSession(
      {
        sessionId: "s_1",
        agentSessionId: "agent_1",
        agentId: CLAUDE_CODE_ID,
        prompt: "continue",
        cwd: "/repo",
      },
      {
        harnessRegistry: registry,
        sessionService,
        eventBus: {
          emit: () => {},
        },
      } as unknown as Parameters<typeof resumeAgentSession>[1],
    );

    expect(getMessages).toHaveBeenCalledWith(expect.anything(), { agentSessionId: "agent_1", cwd: "/repo" });
    expect(resume).toHaveBeenCalledTimes(1);

    const firstCall = resume.mock.calls[0];
    const resumeInput = firstCall?.[1] as { messageOffset?: number } | undefined;
    expect(resumeInput?.messageOffset).toBe(3);
  });

  test("creates the stream entry before waiting for message history", async () => {
    let resolveMessages!: (messages: never[]) => void;
    const pendingMessages = new Promise<never[]>((resolve) => {
      resolveMessages = resolve;
    });
    const getMessages = mock(() => pendingMessages);
    const resume = mock((_ctx: unknown, _input: unknown) => completedSession());

    const registry = createTestHarnessRegistry([
      createTestHarnessRecord("claude-code", { provider: { getMessages, resume } }),
    ]);

    const sessionService = createSessionServiceMock();
    const resumePromise = resumeAgentSession(
      {
        sessionId: "s_1",
        agentSessionId: "agent_1",
        agentId: CLAUDE_CODE_ID,
        prompt: "continue",
        cwd: "/repo",
      },
      {
        harnessRegistry: registry,
        sessionService,
        eventBus: {
          emit: () => {},
        },
      } as unknown as Parameters<typeof resumeAgentSession>[1],
    );

    await Bun.sleep(0);
    expect(sessionService.store.create).toHaveBeenCalledTimes(1);

    resolveMessages([]);
    await resumePromise;

    expect(resume).toHaveBeenCalledTimes(1);
  });
});

describe("spawnAgentSession lifecycle", () => {
  test("fires status hooks when the spawned session exits", async () => {
    const start = mock((_ctx: unknown, _input: unknown) => completedSession());
    const registry = createTestHarnessRegistry([createTestHarnessRecord("claude-code", { provider: { start } })]);

    const transitionStatus = mock(async () => ({ id: "session_1", project_id: "project_1", status: "completed" }));

    await spawnAgentSession(
      {
        sessionId: "session_1",
        agentId: CLAUDE_CODE_ID,
        prompt: "hello",
        cwd: "/repo",
      },
      {
        harnessRegistry: registry,
        eventBus: {
          emit: () => {},
        },
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
            create: mock(() => ({
              ...createStoreEntry(),
            })),
            get: mock(() => null),
            setSession: mock(() => {}),
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

  test("does not overwrite a cancelled session when the session exits later", async () => {
    const start = mock((_ctx: unknown, _input: unknown) => completedSession());
    const registry = createTestHarnessRegistry([createTestHarnessRecord("claude-code", { provider: { start } })]);

    const transitionStatus = mock(async () => ({ id: "session_1", project_id: "project_1", status: "completed" }));
    const remove = mock(() => {});

    await spawnAgentSession(
      {
        sessionId: "session_1",
        agentId: CLAUDE_CODE_ID,
        prompt: "hello",
        cwd: "/repo",
      },
      {
        harnessRegistry: registry,
        eventBus: {
          emit: () => {},
        },
        fileService: {
          get: async () => null,
          upload: async () => ({ id: "file_1" }),
          update: async () => null,
        },
        sessionService: {
          get: mock(async () => ({ id: "session_1", project_id: "project_1", status: "cancelled" })),
          update: async () => null,
          transitionStatus,
          store: {
            create: mock(() => ({
              ...createStoreEntry(),
            })),
            get: mock(() => null),
            setSession: mock(() => {}),
            remove,
          },
        },
      } as unknown as Parameters<typeof spawnAgentSession>[1],
    );

    for (let index = 0; index < 20; index += 1) {
      if (remove.mock.calls.length > 0) break;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    expect(remove).toHaveBeenCalledWith("session_1");
    expect(transitionStatus).not.toHaveBeenCalled();
  });
});
