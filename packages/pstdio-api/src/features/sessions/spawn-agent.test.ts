import { describe, expect, mock, test } from "bun:test";
import type { AgentService } from "pstdio-agents";
import { createSessionStore } from "./session-store";
import { resumeAgentSession } from "./spawn-agent";

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
    const sessionStore = createSessionStore();

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
        sessionStore,
        sessionsService: {
          updateStatus: async () => null,
        },
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

    const sessionStore = createSessionStore();
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
        sessionStore,
        sessionsService: {
          updateStatus: async () => null,
        },
        eventBus: {
          emit: () => {},
        },
      } as unknown as Parameters<typeof resumeAgentSession>[1],
    );

    expect(sessionStore.get("s_1")).not.toBeNull();

    resolveMessages([
      { id: "m1", role: "user", parts: [{ type: "text", text: "hello" }] },
      { id: "m2", role: "assistant", parts: [{ type: "text", text: "hi" }] },
    ]);
    await resumePromise;

    expect(resumeSession).toHaveBeenCalledTimes(1);
  });
});
