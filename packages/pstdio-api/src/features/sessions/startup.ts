import { sessionLogger } from "../../lib/logger";
import type { RouteDeps } from "../deps";
import { reattachAgentSession } from "./spawn-agent";

type Deps = Pick<RouteDeps, "sessionService" | "harnessProviderService" | "eventBus" | "fileService">;

export const resolveOrphanedSessions = async (deps: Deps, signal?: AbortSignal) => {
  const staleSessions = await deps.sessionService.listByStatus("in_progress");
  if (staleSessions.length === 0) return;

  for (const session of staleSessions) {
    if (signal?.aborted) return;

    if (deps.sessionService.store.get(session.id)) continue;

    const resolved = session.agent
      ? await deps.harnessProviderService.resolve(session.agent, session.project_id ?? undefined)
      : null;
    const canReattach = resolved?.provider.reattachSession && session.agent_session_id;

    if (!canReattach) {
      await deps.sessionService.transitionStatus(session.id, "disconnected");
      continue;
    }

    try {
      await reattachAgentSession(
        {
          sessionId: session.id,
          agentSessionId: session.agent_session_id!,
          agentId: session.agent!,
          cwd: session.cwd ?? undefined,
          projectId: session.project_id ?? undefined,
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
