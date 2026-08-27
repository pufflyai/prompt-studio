import { describe, expect, mock, test } from "bun:test";
import type { HarnessSession } from "pstdio-api-contracts";
import { createEventStore } from "pstdio-api-runtime-host";
import { createTestHarnessRecord, createTestHarnessRegistry, testHarnessId } from "../harnesses/test-harness-registry";
import { createSessionStore } from "./session-store";
import { resumeAgentSession, spawnAgentSession } from "./spawn-agent";

const CLAUDE_CODE_ID = testHarnessId("claude-code");

const readyWorkspaceSession = { getWorkspaceBySessionId: async () => null };

const createSessionServiceMock = () => ({
  get: mock(async () => ({ id: "session_1", project_id: "project_1", status: "cancelled" })),
  update: mock(async () => null),
  transitionStatus: mock(async () => null),
  store: {
    create: mock(() => ({
      eventStore: createEventStore(),
      approvalService: { handleResponse: () => {}, dispose: () => {} },
      submittedAttachmentFileIds: new Set<string>(),
    })),
    get: mock(() => null),
    setSession: mock(() => {}),
    remove: mock(() => {}),
  },
});

const depsFor = (
  registry: ReturnType<typeof createTestHarnessRegistry>,
  sessionService: ReturnType<typeof createSessionServiceMock>,
) =>
  ({
    harnessRegistry: registry,
    sessionService,
    eventBus: { emit: () => {} },
    workspaceSessionService: readyWorkspaceSession,
  }) as unknown as Parameters<typeof spawnAgentSession>[1];

const pendingSession = (stop: () => Promise<void>): HarnessSession => ({
  agentSessionId: "accepted-after-cancel",
  done: new Promise(() => {}),
  stop,
});

describe("persisted session cancellation", () => {
  test("stops a start that is accepted after the session was cancelled through the API", async () => {
    const accepted = Promise.withResolvers<HarnessSession>();
    const stop = mock(async () => {});
    const start = mock(() => accepted.promise);
    const registry = createTestHarnessRegistry([createTestHarnessRecord("claude-code", { provider: { start } })]);
    const sessionService = createSessionServiceMock();

    const spawning = spawnAgentSession(
      { sessionId: "session_1", agentId: CLAUDE_CODE_ID, prompt: "start" },
      depsFor(registry, sessionService),
    );
    await Bun.sleep(0);
    accepted.resolve(pendingSession(stop));

    await expect(spawning).rejects.toThrow("cancelled");
    expect(stop).toHaveBeenCalledTimes(1);
    expect(sessionService.store.setSession).not.toHaveBeenCalled();
  });

  test("stops a resume that is accepted after the session was cancelled through the API", async () => {
    const accepted = Promise.withResolvers<HarnessSession>();
    const stop = mock(async () => {});
    const resume = mock(() => accepted.promise);
    const getMessages = mock(async () => []);
    const registry = createTestHarnessRegistry([
      createTestHarnessRecord("claude-code", { provider: { resume, getMessages } }),
    ]);
    const sessionService = createSessionServiceMock();

    const resuming = resumeAgentSession(
      {
        sessionId: "session_1",
        agentSessionId: "agent-session-1",
        agentId: CLAUDE_CODE_ID,
        prompt: "resume",
      },
      depsFor(registry, sessionService),
    );
    await Bun.sleep(0);
    accepted.resolve(pendingSession(stop));

    await expect(resuming).rejects.toThrow("cancelled");
    expect(stop).toHaveBeenCalledTimes(1);
    expect(sessionService.store.setSession).not.toHaveBeenCalled();
  });

  test("lets a cancellation marker win after the database status snapshot was read", async () => {
    const statusSnapshotRead = Promise.withResolvers<void>();
    const releaseStatusRead = Promise.withResolvers<void>();
    const stop = mock(async () => {});
    const start = mock(() => pendingSession(stop));
    const registry = createTestHarnessRegistry([createTestHarnessRecord("claude-code", { provider: { start } })]);
    const store = createSessionStore();
    const sessionService = {
      get: mock(async () => {
        statusSnapshotRead.resolve();
        await releaseStatusRead.promise;
        return { id: "session_1", project_id: "project_1", status: "in_progress" };
      }),
      update: mock(async () => null),
      transitionStatus: mock(async () => null),
      store,
    };

    const spawning = spawnAgentSession(
      { sessionId: "session_1", agentId: CLAUDE_CODE_ID, prompt: "start" },
      depsFor(registry, sessionService as never),
    );
    await statusSnapshotRead.promise;
    store.markCancellationRequested("session_1");
    releaseStatusRead.resolve();

    await expect(spawning).rejects.toThrow("cancelled");
    expect(stop).toHaveBeenCalledTimes(1);
    expect(store.get("session_1")).toBeNull();
  });
});
