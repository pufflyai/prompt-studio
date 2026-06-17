import { sessionLogger } from "../../lib/logger";
import type { SessionsRouteDeps } from "./deps";
import { reattachAgentSession } from "./spawn-agent";

type Deps = Pick<
  SessionsRouteDeps,
  "sessionService" | "harnessRegistry" | "eventBus" | "fileService" | "sessionQueueEntriesService"
>;

const removeDispatchStartedEntriesForSession = async (deps: Deps, sessionId: string) => {
  const entries = await deps.sessionQueueEntriesService.listDispatchStarted();
  for (const entry of entries) {
    if (entry.session_id === sessionId) {
      await deps.sessionQueueEntriesService.remove(entry.queue_position);
    }
  }
};

export const resolveOrphanedSessions = async (deps: Deps, signal?: AbortSignal) => {
  const staleSessions = await deps.sessionService.listByStatus("in_progress");
  if (staleSessions.length === 0) return;

  for (const session of staleSessions) {
    if (signal?.aborted) return;

    if (deps.sessionService.store.get(session.id)) continue;

    const harness = session.agent ? await deps.harnessRegistry.get(session.agent) : null;
    const canReattach =
      harness?.supportsReattach &&
      (await harness.capabilities()).includes("SessionReattach") &&
      session.agent_session_id;

    if (!canReattach) {
      await deps.sessionService.transitionStatus(session.id, "disconnected");
      continue;
    }

    try {
      await reattachAgentSession(
        {
          sessionId: session.id,
          projectId: session.project_id ?? undefined,
          agentSessionId: session.agent_session_id!,
          agentId: session.agent!,
          cwd: session.cwd ?? undefined,
        },
        deps,
      );
    } catch (err) {
      sessionLogger.warn(
        { err, event: "session.reattach.failed", session_id: session.id },
        "Failed to reattach orphaned session; marking disconnected",
      );
      await removeDispatchStartedEntriesForSession(deps, session.id);
      await deps.sessionService.transitionStatus(session.id, "disconnected");
    }
  }
};
