import { describe, expect, mock, test } from "bun:test";
import type {
  HarnessEventStore,
  HarnessResumeResult,
  HarnessSessionMessageInput,
  HarnessSessionMessagesInput,
  HarnessSessionStartInput,
  HarnessSessionStartResult,
  RuntimeHarnessProvider,
} from "@pstdio/sdk/extensions";
import { createEventStore } from "pstdio-agents";
import { resumeAgentSession, spawnAgentSession } from "./spawn-agent";

const createStoreEntry = () => ({
  eventStore: createEventStore(),
  approvalService: { handleResponse: () => {}, dispose: () => {} },
});

const getFirstMockArg = <T>(fn: { mock: { calls: unknown[][] } }) => fn.mock.calls[0]?.[0] as T | undefined;

const createRuntimeProvider = (provider: {
  startSession?: (input: HarnessSessionStartInput) => Promise<unknown>;
  resumeSession?: (
    input: HarnessSessionMessageInput,
    eventStore: HarnessEventStore,
    approvalService: unknown,
  ) => Promise<unknown>;
  getMessages?: (sessionId: string, input?: HarnessSessionMessagesInput) => Promise<unknown>;
}) =>
  ({
    id: "pstdio.harness.claude-code",
    key: "claudeCode",
    extensionId: "pstdio.harness.claude-code",
    label: "Claude Code",
    start: async () => ({ runId: "run" }),
    startSession: provider.startSession
      ? (_ctx, input) => provider.startSession!(input) as Promise<HarnessSessionStartResult>
      : async () => ({ sessionId: "agent_session_1" }),
    resumeSession: provider.resumeSession
      ? (_ctx, input, eventStore, approvalService) =>
          provider.resumeSession!(input, eventStore, approvalService) as Promise<HarnessResumeResult>
      : async () => ({}),
    getMessages: provider.getMessages
      ? (_ctx, sessionId, input) => provider.getMessages!(sessionId, input) as Promise<unknown[]>
      : undefined,
  }) satisfies RuntimeHarnessProvider;

const createDeps = (input: { provider: RuntimeHarnessProvider; sessionService: unknown; fileService?: unknown }) =>
  ({
    harnessProviderService: {
      resolve: mock(async () => ({ provider: input.provider, context: {} })),
    },
    eventBus: { emit: () => {} },
    fileService: input.fileService ?? {
      get: async () => null,
      upload: async () => ({ id: "file_1" }),
      update: async () => null,
    },
    sessionService: input.sessionService,
  }) as unknown as Parameters<typeof spawnAgentSession>[1];

const createSessionService = (
  overrides: { get?: unknown; transitionStatus?: unknown; remove?: unknown; create?: unknown } = {},
) => {
  const storeEntries = new Map<string, unknown>();

  return {
    get: overrides.get ?? mock(async () => ({ id: "session_1", project_id: "project_1", status: "in_progress" })),
    update: async () => null,
    transitionStatus: overrides.transitionStatus ?? mock(async () => null),
    store: {
      create:
        overrides.create ??
        mock((id: string) => {
          const entry = createStoreEntry();
          storeEntries.set(id, entry);
          return entry;
        }),
      get: mock((id: string) => storeEntries.get(id) ?? null),
      setProcess: mock(() => {}),
      remove: overrides.remove ?? mock(() => {}),
    },
  };
};

describe("resumeAgentSession", () => {
  test("uses existing message count as default messageOffset", async () => {
    const getMessages = mock(async () => [
      { id: "m1", role: "user", parts: [{ type: "text", text: "hello" }] },
      { id: "m2", role: "assistant", parts: [{ type: "text", text: "hi" }] },
      { id: "m3", role: "user", parts: [{ type: "text", text: "continue" }] },
    ]);
    const resumeSession = mock(async () => ({}));
    const sessionService = createSessionService();

    await resumeAgentSession(
      {
        sessionId: "s_1",
        agentSessionId: "agent_1",
        agentId: "claude-code",
        prompt: "continue",
        cwd: "/repo",
      },
      createDeps({ provider: createRuntimeProvider({ getMessages, resumeSession }), sessionService }),
    );

    expect(getMessages).toHaveBeenCalledWith("agent_1", { cwd: "/repo" });
    expect(resumeSession).toHaveBeenCalledTimes(1);
    expect(getFirstMockArg<{ messageOffset?: number }>(resumeSession)?.messageOffset).toBe(3);
  });

  test("creates the stream entry before waiting for message history", async () => {
    let resolveMessages!: (messages: unknown[]) => void;
    const pendingMessages = new Promise<unknown[]>((resolve) => {
      resolveMessages = resolve;
    });
    const getMessages = mock(() => pendingMessages);
    const resumeSession = mock(async () => ({}));
    const sessionService = createSessionService();

    const resumePromise = resumeAgentSession(
      {
        sessionId: "s_1",
        agentSessionId: "agent_1",
        agentId: "claude-code",
        prompt: "continue",
        cwd: "/repo",
      },
      createDeps({ provider: createRuntimeProvider({ getMessages, resumeSession }), sessionService }),
    );

    const storeCreate = sessionService.store.create as unknown as { mock: { calls: unknown[][] } };
    for (let index = 0; index < 10; index += 1) {
      if (storeCreate.mock.calls.length > 0) break;
      await Bun.sleep(0);
    }

    expect(storeCreate).toHaveBeenCalledTimes(1);

    resolveMessages([
      { id: "m1", role: "user", parts: [{ type: "text", text: "hello" }] },
      { id: "m2", role: "assistant", parts: [{ type: "text", text: "hi" }] },
    ]);
    await resumePromise;

    expect(resumeSession).toHaveBeenCalledTimes(1);
  });

  test("passes PSTDIO_SESSION_ID to resumed harness sessions", async () => {
    const resumeSession = mock(async () => ({}));

    await resumeAgentSession(
      {
        sessionId: "s_42",
        agentSessionId: "agent_1",
        agentId: "claude-code",
        prompt: "continue",
      },
      createDeps({ provider: createRuntimeProvider({ resumeSession }), sessionService: createSessionService() }),
    );

    expect(getFirstMockArg<{ env?: Record<string, string> }>(resumeSession)?.env?.PSTDIO_SESSION_ID).toBe("s_42");
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
    const transitionStatus = mock(async () => ({ id: "session_1", project_id: "project_1", status: "completed" }));
    const sessionService = createSessionService({ transitionStatus });

    await spawnAgentSession(
      {
        sessionId: "session_1",
        agentId: "claude-code",
        prompt: "hello",
        cwd: "/repo",
      },
      createDeps({ provider: createRuntimeProvider({ startSession }), sessionService }),
    );

    for (let index = 0; index < 20; index += 1) {
      if (transitionStatus.mock.calls.length > 0) break;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    expect(transitionStatus).toHaveBeenCalledWith("session_1", "completed");
  });

  test("does not overwrite a cancelled session when the process exits later", async () => {
    const startSession = mock(async () => ({
      sessionId: "agent_session_1",
      process: {
        onExit: Promise.resolve({ code: 0, signal: null }),
      },
    }));
    const transitionStatus = mock(async () => ({ id: "session_1", project_id: "project_1", status: "completed" }));
    const remove = mock(() => {});
    const sessionService = createSessionService({
      get: mock(async () => ({ id: "session_1", project_id: "project_1", status: "cancelled" })),
      transitionStatus,
      remove,
    });

    await spawnAgentSession(
      {
        sessionId: "session_1",
        agentId: "claude-code",
        prompt: "hello",
        cwd: "/repo",
      },
      createDeps({ provider: createRuntimeProvider({ startSession }), sessionService }),
    );

    for (let index = 0; index < 20; index += 1) {
      if (remove.mock.calls.length > 0) break;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    expect(remove).toHaveBeenCalledWith("session_1");
    expect(transitionStatus).not.toHaveBeenCalled();
  });

  test("passes PSTDIO_SESSION_ID to started harness sessions", async () => {
    const startSession = mock(async () => ({ sessionId: "agent_session_1" }));

    await spawnAgentSession(
      {
        sessionId: "session_99",
        agentId: "claude-code",
        prompt: "hello",
      },
      createDeps({ provider: createRuntimeProvider({ startSession }), sessionService: createSessionService() }),
    );

    expect(getFirstMockArg<{ env?: Record<string, string> }>(startSession)?.env?.PSTDIO_SESSION_ID).toBe("session_99");
  });
});
