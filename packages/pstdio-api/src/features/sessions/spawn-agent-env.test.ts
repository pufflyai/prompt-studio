import { describe, expect, mock, test } from "bun:test";
import type { HarnessContext } from "@pstdio/sdk/extensions";
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
      setSession: mock(() => {}),
      remove: mock(() => {}),
    },
  };
};

const baseDeps = (registry: ReturnType<typeof createTestHarnessRegistry>) =>
  ({
    harnessRegistry: registry,
    eventBus: { emit: () => {} },
    fileService: {
      get: async () => null,
      upload: async () => ({ id: "file_1" }),
      update: async () => null,
    },
    sessionService: createSessionService(),
  }) as unknown as Parameters<typeof spawnAgentSession>[1];

// Providers build their own env from input.sessionId and ctx.projectId, so the
// host contract is: forward the host session id and run the call with projectId.
describe("spawnAgentSession provider context", () => {
  test("passes the host session id and project context to started sessions", async () => {
    const start = mock((_ctx: HarnessContext, _input: { sessionId: string }) => completedSession());
    const registry = createTestHarnessRegistry([createTestHarnessRecord("claude-code", { provider: { start } })]);

    await spawnAgentSession(
      {
        sessionId: "session_99",
        projectId: "project_99",
        agentId: CLAUDE_CODE_ID,
        prompt: "hello",
      },
      baseDeps(registry),
    );

    const ctx = start.mock.calls[0]?.[0];
    const startInput = start.mock.calls[0]?.[1];
    expect(ctx?.projectId).toBe("project_99");
    expect(startInput?.sessionId).toBe("session_99");
  });

  test("passes the host session id and project context to resumed sessions", async () => {
    const resume = mock((_ctx: HarnessContext, _input: { sessionId: string; agentSessionId: string }) =>
      completedSession(),
    );
    const registry = createTestHarnessRegistry([createTestHarnessRecord("claude-code", { provider: { resume } })]);

    await resumeAgentSession(
      {
        sessionId: "s_42",
        projectId: "project_42",
        agentSessionId: "agent_1",
        agentId: CLAUDE_CODE_ID,
        prompt: "continue",
      },
      baseDeps(registry) as unknown as Parameters<typeof resumeAgentSession>[1],
    );

    const ctx = resume.mock.calls[0]?.[0];
    const resumeInput = resume.mock.calls[0]?.[1];
    expect(ctx?.projectId).toBe("project_42");
    expect(resumeInput?.sessionId).toBe("s_42");
    expect(resumeInput?.agentSessionId).toBe("agent_1");
  });
});
