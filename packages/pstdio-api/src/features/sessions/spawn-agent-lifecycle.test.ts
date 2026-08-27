import { describe, expect, mock, test } from "bun:test";
import type { HarnessSession } from "pstdio-api-contracts";
import { createEventStore } from "pstdio-api-runtime-host";
import { createTestHarnessRecord, createTestHarnessRegistry, testHarnessId } from "../harnesses/test-harness-registry";
import { spawnAgentSession } from "./spawn-agent";

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

// The readiness gate is required on every entrypoint now, so tests that don't exercise it
// supply a "no workspace" service: a null lookup means "not provisioning, not errored".
const readyWorkspaceSession = { getWorkspaceBySessionId: async () => null };

const createSessionServiceMock = () => {
  const storeEntries = new Map<string, unknown>();
  return {
    get: mock(async () => null),
    update: mock(async () => null),
    transitionStatus: mock(async () => null),
    store: {
      create: mock((id: string) => {
        const entry = createStoreEntry();
        storeEntries.set(id, entry);
        return entry;
      }),
      get: mock((id: string) => storeEntries.get(id) ?? null),
      setSession: mock(() => true),
      remove: mock(() => {}),
    },
  };
};

describe("spawnAgentSession lifecycle", () => {
  test("stops an accepted harness session when cancellation lands during start", async () => {
    let finishStart!: (session: HarnessSession) => void;
    const stop = mock(async () => {});
    const start = mock(() => new Promise<HarnessSession>((resolve) => (finishStart = resolve)));
    const registry = createTestHarnessRegistry([createTestHarnessRecord("claude-code", { provider: { start } })]);
    const sessionService = createSessionServiceMock();
    const controller = new AbortController();

    const spawning = spawnAgentSession(
      {
        sessionId: "s_cancelled_start",
        agentId: CLAUDE_CODE_ID,
        prompt: "start",
        signal: controller.signal,
      } as never,
      {
        harnessRegistry: registry,
        sessionService,
        eventBus: { emit: () => {} },
        workspaceSessionService: readyWorkspaceSession,
      } as unknown as Parameters<typeof spawnAgentSession>[1],
    );
    await Bun.sleep(0);
    controller.abort(new DOMException("cancelled", "AbortError"));
    finishStart({ agentSessionId: "accepted-1", done: new Promise(() => {}), stop });

    await expect(spawning).rejects.toThrow();
    expect(stop).toHaveBeenCalledTimes(1);
    expect(sessionService.store.setSession).not.toHaveBeenCalled();
  });

  test("stops a running harness session when its originating request is cancelled", async () => {
    const stop = mock(async () => {});
    const start = mock(() => ({ agentSessionId: "accepted-1", done: new Promise<never>(() => {}), stop }));
    const registry = createTestHarnessRegistry([createTestHarnessRecord("claude-code", { provider: { start } })]);
    const sessionService = createSessionServiceMock();
    const controller = new AbortController();

    await spawnAgentSession(
      {
        sessionId: "s_cancelled_running",
        agentId: CLAUDE_CODE_ID,
        prompt: "start",
        signal: controller.signal,
      } as never,
      {
        harnessRegistry: registry,
        sessionService,
        eventBus: { emit: () => {} },
        workspaceSessionService: readyWorkspaceSession,
      } as unknown as Parameters<typeof spawnAgentSession>[1],
    );
    controller.abort(new DOMException("cancelled", "AbortError"));
    await Bun.sleep(0);

    expect(stop).toHaveBeenCalledTimes(1);
    expect(sessionService.transitionStatus).toHaveBeenCalledWith("s_cancelled_running", "cancelled");
  });

  test("rejects and cancels when cancellation lands while the accepted session id is persisted", async () => {
    const persistence = Promise.withResolvers<null>();
    const stop = mock(async () => {});
    const start = mock(() => ({ agentSessionId: "accepted-1", done: new Promise<never>(() => {}), stop }));
    const registry = createTestHarnessRegistry([createTestHarnessRecord("claude-code", { provider: { start } })]);
    const sessionService = createSessionServiceMock();
    sessionService.update.mockImplementation(() => persistence.promise);
    const controller = new AbortController();

    const spawning = spawnAgentSession(
      {
        sessionId: "s_cancelled_persist",
        agentId: CLAUDE_CODE_ID,
        prompt: "start",
        signal: controller.signal,
      } as never,
      {
        harnessRegistry: registry,
        sessionService,
        eventBus: { emit: () => {} },
        workspaceSessionService: readyWorkspaceSession,
      } as unknown as Parameters<typeof spawnAgentSession>[1],
    );
    await Bun.sleep(0);
    controller.abort(new DOMException("cancelled", "AbortError"));
    persistence.resolve(null);

    await expect(spawning).rejects.toThrow();
    expect(stop).toHaveBeenCalledTimes(1);
    expect(sessionService.store.setSession).not.toHaveBeenCalled();
    expect(sessionService.transitionStatus).toHaveBeenCalledWith("s_cancelled_persist", "cancelled");
  });

  test("keeps the session active and tracked when request cancellation cleanup fails", async () => {
    const persistence = Promise.withResolvers<null>();
    const stop = mock(async () => {
      throw new Error("remote delete failed");
    });
    const start = mock(() => ({ agentSessionId: "accepted-1", done: new Promise<never>(() => {}), stop }));
    const registry = createTestHarnessRegistry([createTestHarnessRecord("claude-code", { provider: { start } })]);
    const sessionService = createSessionServiceMock();
    sessionService.update.mockImplementation(() => persistence.promise);
    const controller = new AbortController();

    const spawning = spawnAgentSession(
      { sessionId: "s_cleanup_failed", agentId: CLAUDE_CODE_ID, prompt: "start", signal: controller.signal } as never,
      {
        harnessRegistry: registry,
        sessionService,
        eventBus: { emit: () => {} },
        workspaceSessionService: readyWorkspaceSession,
      } as unknown as Parameters<typeof spawnAgentSession>[1],
    );
    await Bun.sleep(0);
    controller.abort(new DOMException("cancelled", "AbortError"));
    persistence.resolve(null);

    await expect(spawning).rejects.toThrow("remote delete failed");
    expect(sessionService.transitionStatus).not.toHaveBeenCalled();
    expect(sessionService.store.setSession).toHaveBeenCalledWith(
      "s_cleanup_failed",
      expect.objectContaining({ agentSessionId: "accepted-1" }),
    );
  });

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
        workspaceSessionService: readyWorkspaceSession,
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
            setSession: mock(() => true),
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
    const get = mock(async () => ({ id: "session_1", project_id: "project_1", status: "cancelled" }));
    get.mockResolvedValueOnce({ id: "session_1", project_id: "project_1", status: "in_progress" });

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
        workspaceSessionService: readyWorkspaceSession,
        fileService: {
          get: async () => null,
          upload: async () => ({ id: "file_1" }),
          update: async () => null,
        },
        sessionService: {
          get,
          update: async () => null,
          transitionStatus,
          store: {
            create: mock(() => ({
              ...createStoreEntry(),
            })),
            get: mock(() => null),
            setSession: mock(() => true),
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
