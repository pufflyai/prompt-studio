import type { AgentId, ApprovalRequest } from "pstdio-agents";
import type { RouteDeps } from "../deps";
import { persistSessionMessages } from "./session-messages";

type SpawnInput = {
  sessionId: string;
  agentId: string;
  prompt: string;
  title?: string;
  model?: string;
  cwd?: string;
};

type SpawnDeps = Pick<RouteDeps, "agentRegistry" | "eventBus" | "fileService" | "sessionService">;

// Spawns a new agent session and tracks the process lifecycle
export const spawnAgentSession = async (input: SpawnInput, deps: SpawnDeps) => {
  const agent = deps.agentRegistry.get(input.agentId as AgentId);
  if (!agent) throw new Error(`Agent not found: ${input.agentId}`);

  const entry = deps.sessionService.store.create(input.sessionId, (request: ApprovalRequest) => {
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
    await deps.sessionService.update(input.sessionId, { agent_session_id: result.sessionId });
  }

  if (result.process) {
    deps.sessionService.store.setProcess(input.sessionId, result.process);
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

  const entry = deps.sessionService.store.create(input.sessionId, (request: ApprovalRequest) => {
    entry.eventStore.push({ op: "add", path: "/approval_request", value: request });
  });

  // Resume streams emit index-based message patches, so we align indices with existing history.
  let messageOffset = input.messageOffset;
  if (messageOffset === undefined) {
    try {
      const messages = await agent.getMessages(input.agentSessionId, input.cwd ? { cwd: input.cwd } : undefined);
      messageOffset = messages.length;
    } catch {
      messageOffset = 0;
    }
  }

  const result = await agent.resumeSession(
    {
      sessionId: input.agentSessionId,
      prompt: input.prompt,
      model: input.model,
      cwd: input.cwd,
      messageOffset,
    },
    entry.eventStore,
    entry.approvalService,
  );

  if (result.process) {
    deps.sessionService.store.setProcess(input.sessionId, result.process);
    trackProcessExit(input.sessionId, result.process, deps);
  }

  return result;
};

const trackProcessExit = (
  sessionId: string,
  process: { onExit: Promise<{ code: number | null; signal: string | null }> },
  deps: SpawnDeps,
) => {
  process.onExit.then(async ({ code, signal }) => {
    const entry = deps.sessionService.store.get(sessionId);
    if (entry) {
      const patches = entry.eventStore.getHistory();
      await persistSessionMessages(sessionId, patches, deps).catch(() => {});
    }

    const status = code === 0 ? "completed" : "failed";
    if (status === "failed") {
      console.error(`[session] agent process exited with code=${code} signal=${signal} for session ${sessionId}`);
    }
    await deps.sessionService.transitionStatus(sessionId, status);
    deps.sessionService.store.remove(sessionId);
  });
};
