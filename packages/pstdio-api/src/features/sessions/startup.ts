import type { AgentId } from "pstdio-agents";
import type { RouteDeps } from "../deps";

type Deps = Pick<RouteDeps, "sessionService" | "agentRegistry" | "eventBus">;

type StaleSession = {
  id: string;
  agent: string | null;
  agent_session_id: string | null;
  cwd: string | null;
};

const resolveSessionStatus = async (session: StaleSession, deps: Deps) => {
  const agent = session.agent ? deps.agentRegistry.get(session.agent as AgentId) : null;
  if (!agent || !session.agent_session_id) return "completed" as const;

  try {
    const cwd = session.cwd;
    const messages = await agent.getMessages(session.agent_session_id, cwd ? { cwd } : undefined);
    return messages.length > 0 ? ("completed" as const) : ("failed" as const);
  } catch {
    return "failed" as const;
  }
};

export const resolveOrphanedSessions = async (deps: Deps, signal?: AbortSignal) => {
  const staleSessions = await deps.sessionService.listByStatus("in_progress");
  if (staleSessions.length === 0) return;

  for (const session of staleSessions) {
    if (signal?.aborted) return;

    // Skip sessions that have an active process (they're legitimately in_progress)
    if (deps.sessionService.store.get(session.id)) continue;

    const status = await resolveSessionStatus(session, deps);
    await deps.sessionService.transitionStatus(session.id, status);
  }
};
