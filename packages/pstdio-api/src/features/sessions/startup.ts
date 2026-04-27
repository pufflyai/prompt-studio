import type { AgentId } from "pstdio-agents";
import { sessionLogger } from "../../lib/logger";
import type { RouteDeps } from "../deps";
import { toAgentId } from "../harnesses/harness-ids";
import { reattachAgentSession } from "./spawn-agent";

type Deps = Pick<RouteDeps, "sessionService" | "agentRegistry" | "eventBus" | "fileService">;

export const resolveOrphanedSessions = async (deps: Deps, signal?: AbortSignal) => {
  const staleSessions = await deps.sessionService.listByStatus("in_progress");
  if (staleSessions.length === 0) return;

  for (const session of staleSessions) {
    if (signal?.aborted) return;

    if (deps.sessionService.store.get(session.id)) continue;

    const agentId = session.agent ? toAgentId(session.agent) : null;
    const agent = agentId ? deps.agentRegistry.get(agentId as AgentId) : null;
    const canReattach =
      agent?.reattachSession && agent.capabilities().includes("SessionReattach") && session.agent_session_id;

    if (!canReattach) {
      await deps.sessionService.transitionStatus(session.id, "disconnected");
      continue;
    }

    try {
      await reattachAgentSession(
        {
          sessionId: session.id,
          agentSessionId: session.agent_session_id!,
          agentId: agentId!,
          cwd: session.cwd ?? undefined,
        },
        deps,
      );
    } catch (err) {
      sessionLogger.warn(
        { err, event: "session.reattach.failed", session_id: session.id },
        "Failed to reattach orphaned session; marking disconnected",
      );
      await deps.sessionService.transitionStatus(session.id, "disconnected");
    }
  }
};
