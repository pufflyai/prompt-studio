import type { AgentId } from "pstdio-agents";
import type { RouteDeps } from "../deps";
import { resolveSessionCwd } from "./resolve-session-cwd";

type Deps = Pick<
  RouteDeps,
  | "sessionsService"
  | "workspacesService"
  | "workspaceSessionsService"
  | "reposService"
  | "agentRegistry"
  | "eventBus"
  | "sessionStore"
  | "db"
>;

type StaleSession = {
  id: string;
  agent: string | null;
  agent_session_id: string | null;
  project_id: string | null;
};

const resolveSessionStatus = async (session: StaleSession, deps: Deps) => {
  const agent = session.agent ? deps.agentRegistry.get(session.agent as AgentId) : null;
  if (!agent || !session.agent_session_id) return "completed" as const;

  try {
    const workspace = await deps.workspaceSessionsService.getWorkspaceBySessionId(session.id);
    const cwd = session.project_id ? await resolveSessionCwd(deps, session.project_id, workspace?.id) : undefined;

    const messages = await agent.getMessages(session.agent_session_id, cwd ? { cwd } : undefined);
    return messages.length > 0 ? ("completed" as const) : ("failed" as const);
  } catch {
    return "failed" as const;
  }
};

export const resolveOrphanedSessions = async (deps: Deps, signal?: AbortSignal) => {
  const staleSessions = await deps.sessionsService.listByStatus("in_progress");
  if (staleSessions.length === 0) return;

  for (const session of staleSessions) {
    if (signal?.aborted) return;

    // Skip sessions that have an active process (they're legitimately in_progress)
    if (deps.sessionStore?.get(session.id)) continue;

    const status = await resolveSessionStatus(session, deps);
    const updated = await deps.sessionsService.updateStatus(session.id, status);
    if (updated) deps.eventBus.emit("sessions", "set", updated);
  }
};
