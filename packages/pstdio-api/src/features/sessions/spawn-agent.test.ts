import { describe, expect, mock, test } from "bun:test";
import type { HarnessSession } from "pstdio-api-contracts";
import { createEventStore } from "pstdio-api-runtime-host";
import { createTestHarnessRecord, createTestHarnessRegistry, testHarnessId } from "../harnesses/test-harness-registry";
import { reattachAgentSession, resumeAgentSession, spawnAgentSession } from "./spawn-agent";

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
        workspaceSessionService: readyWorkspaceSession,
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
        workspaceSessionService: readyWorkspaceSession,
      } as unknown as Parameters<typeof resumeAgentSession>[1],
    );

    await Bun.sleep(0);
    expect(sessionService.store.create).toHaveBeenCalledTimes(1);

    resolveMessages([]);
    await resumePromise;

    expect(resume).toHaveBeenCalledTimes(1);
  });
});

describe("workspace readiness gate", () => {
  // A failed provision clears `initializing` but records `setup_error`. Every harness
  // entrypoint must refuse to launch into that half-synced tree, not just the new-session path.
  const erroredWorkspace = {
    getWorkspaceBySessionId: async () => ({ id: "w1", initializing: false, setup_error: "skill sync failed" }),
  };

  test("resumeAgentSession refuses to launch when the workspace failed to provision", async () => {
    const { registry, resume } = buildHarness();
    const sessionService = createSessionServiceMock();

    await expect(
      resumeAgentSession(
        { sessionId: "s_1", agentSessionId: "agent_1", agentId: CLAUDE_CODE_ID, prompt: "continue", cwd: "/repo" },
        {
          harnessRegistry: registry,
          sessionService,
          eventBus: { emit: () => {} },
          workspaceSessionService: erroredWorkspace,
        } as unknown as Parameters<typeof resumeAgentSession>[1],
      ),
    ).rejects.toThrow(/failed to provision/);

    expect(resume).not.toHaveBeenCalled();
  });

  test("reattachAgentSession refuses to launch when the workspace failed to provision", async () => {
    const reattach = mock((_ctx: unknown, _input: unknown) => completedSession());
    const registry = createTestHarnessRegistry([createTestHarnessRecord("claude-code", { provider: { reattach } })]);
    const sessionService = createSessionServiceMock();

    await expect(
      reattachAgentSession({ sessionId: "s_1", agentSessionId: "agent_1", agentId: CLAUDE_CODE_ID, cwd: "/repo" }, {
        harnessRegistry: registry,
        sessionService,
        eventBus: { emit: () => {} },
        workspaceSessionService: erroredWorkspace,
      } as unknown as Parameters<typeof reattachAgentSession>[1]),
    ).rejects.toThrow(/failed to provision/);

    expect(reattach).not.toHaveBeenCalled();
  });

  test("spawnAgentSession refuses to launch when provider creation failed", async () => {
    const start = mock((_ctx: unknown, _input: unknown) => completedSession());
    const registry = createTestHarnessRegistry([createTestHarnessRecord("claude-code", { provider: { start } })]);
    const sessionService = createSessionServiceMock();

    await expect(
      spawnAgentSession({ sessionId: "s_1", agentId: CLAUDE_CODE_ID, prompt: "start", cwd: undefined }, {
        harnessRegistry: registry,
        sessionService,
        eventBus: { emit: () => {} },
        workspaceSessionService: {
          getWorkspaceBySessionId: async () => ({
            id: "w1",
            initializing: false,
            setup_error: null,
            provider_state: "failed",
            execution_kind: "local",
            provider_error_json: { message: "worktree add failed" },
          }),
        },
      } as unknown as Parameters<typeof spawnAgentSession>[1]),
    ).rejects.toThrow(/worktree add failed/);

    expect(start).not.toHaveBeenCalled();
  });

  test("spawnAgentSession passes a remote execution target to a harness that accepts it", async () => {
    const start = mock((_ctx: unknown, _input: unknown) => completedSession());
    const registry = createTestHarnessRegistry([
      createTestHarnessRecord("remote", {
        provider: { cwdRequirement: "optional", start } as never,
      }),
    ]);
    const sessionService = createSessionServiceMock();

    await spawnAgentSession(
      {
        sessionId: "s_remote",
        projectId: "project_1",
        agentId: testHarnessId("remote"),
        prompt: "start remotely",
      },
      {
        harnessRegistry: registry,
        sessionService,
        eventBus: { emit: () => {} },
        workspaceSessionService: {
          getWorkspaceBySessionId: async () => ({
            id: "w_remote",
            initializing: false,
            setup_error: null,
            provider_id: "pstdio.remote",
            provider_ref_json: { version: 1, data: { workspace: "remote_1" } },
            provider_state: "ready",
            execution_kind: "remote",
            display_path: "remote://workspace/remote_1",
          }),
        },
      } as unknown as Parameters<typeof spawnAgentSession>[1],
    );

    expect(start).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        cwd: undefined,
        workspace: {
          workspaceId: "w_remote",
          executionTarget: {
            kind: "remote",
            providerId: "pstdio.remote",
            providerRef: { version: 1, data: { workspace: "remote_1" } },
            displayPath: "remote://workspace/remote_1",
          },
        },
      }),
    );
  });
});
