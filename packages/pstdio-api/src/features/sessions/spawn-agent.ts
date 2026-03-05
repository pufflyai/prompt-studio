import type { AgentId, ApprovalRequest } from "pstdio-agents";
import type { RouteDeps } from "../deps";

type SpawnInput = {
  sessionId: string;
  agentId: string;
  prompt: string;
  title?: string;
  model?: string;
  cwd?: string;
};

type SpawnDeps = Pick<RouteDeps, "agentRegistry" | "sessionStore" | "sessionsService" | "eventBus">;

// Spawns a new agent session and tracks the process lifecycle
export const spawnAgentSession = async (input: SpawnInput, deps: SpawnDeps) => {
  const agent = deps.agentRegistry.get(input.agentId as AgentId);
  if (!agent) throw new Error(`Agent not found: ${input.agentId}`);

  const entry = deps.sessionStore.create(input.sessionId, (request: ApprovalRequest) => {
    entry.eventStore.push({ op: "add", path: "/approval_request", value: request });
  });

  const result = await agent.startSession({
    prompt: input.prompt,
    title: input.title,
    model: input.model,
    cwd: input.cwd,
    eventStore: entry.eventStore,
  });

  if (result.sessionId) {
    await deps.sessionsService.update(input.sessionId, { agent_session_id: result.sessionId });
  }

  if (result.process) {
    deps.sessionStore.setProcess(input.sessionId, result.process);
    trackProcessExit(input.sessionId, result.process, deps);
  }

  return result;
};

type ResumeInput = {
  sessionId: string;
  agentSessionId: string;
  agentId: string;
  prompt: string;
  model?: string;
  cwd?: string;
  messageOffset?: number;
};

// Resumes an existing agent session with a follow-up prompt
export const resumeAgentSession = async (input: ResumeInput, deps: SpawnDeps) => {
  const agent = deps.agentRegistry.get(input.agentId as AgentId);
  if (!agent) throw new Error(`Agent not found: ${input.agentId}`);

  const entry = deps.sessionStore.create(input.sessionId, (request: ApprovalRequest) => {
    entry.eventStore.push({ op: "add", path: "/approval_request", value: request });
  });

  const result = await agent.resumeSession(
    {
      sessionId: input.agentSessionId,
      prompt: input.prompt,
      model: input.model,
      cwd: input.cwd,
      messageOffset: input.messageOffset,
    },
    entry.eventStore,
    entry.approvalService,
  );

  if (result.process) {
    deps.sessionStore.setProcess(input.sessionId, result.process);
    trackProcessExit(input.sessionId, result.process, deps);
  }

  return result;
};

const trackProcessExit = (
  sessionId: string,
  process: { onExit: Promise<{ code: number | null; signal: string | null }> },
  deps: SpawnDeps,
) => {
  process.onExit.then(async ({ code }) => {
    const status = code === 0 ? "completed" : "failed";
    const updated = await deps.sessionsService.updateStatus(sessionId, status);
    if (updated) deps.eventBus.emit("sessions", "set", updated);
    deps.sessionStore.remove(sessionId);
  });
};
