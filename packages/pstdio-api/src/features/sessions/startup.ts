import { sessionLogger } from "../../lib/logger";
import type { SessionsRouteDeps } from "./deps";
import { getSessionHarness } from "./get-session-harness";
import { reattachAgentSession } from "./spawn-agent";

type Deps = Pick<
  SessionsRouteDeps,
  | "sessionService"
  | "harnessRegistry"
  | "eventBus"
  | "fileService"
  | "sessionQueueEntriesService"
  | "workspaceSessionService"
>;

const removeDispatchStartedEntriesForSession = async (deps: Deps, sessionId: string) => {
  const entries = await deps.sessionQueueEntriesService.listDispatchStarted();
  for (const entry of entries) {
    if (entry.session_id === sessionId) {
      await deps.sessionQueueEntriesService.remove(entry.queue_position);
    }
  }
};

const getDispatchStartedEntryForSession = async (deps: Deps, sessionId: string) => {
  const entries = await deps.sessionQueueEntriesService.listDispatchStarted();
  return entries.find((entry) => entry.session_id === sessionId);
};

export const resolveOrphanedSessions = async (deps: Deps, signal?: AbortSignal) => {
  const staleSessions = await deps.sessionService.listByStatus("in_progress");
  if (staleSessions.length === 0) return;

  for (const session of staleSessions) {
    if (signal?.aborted) return;

    if (deps.sessionService.store.get(session.id)) continue;

    const harness = await getSessionHarness(deps.harnessRegistry, session);
    const canReattach =
      harness?.supportsReattach &&
      (await harness.capabilities()).includes("SessionReattach") &&
      session.agent_session_id;

    if (!canReattach) {
      await deps.sessionService.transitionStatus(session.id, "disconnected");
      continue;
    }

    try {
      const dispatchEntry = await getDispatchStartedEntryForSession(deps, session.id);
      await reattachAgentSession(
        {
          sessionId: session.id,
          projectId: session.project_id ?? undefined,
          agentSessionId: session.agent_session_id!,
          agentId: session.agent!,
          cwd: session.cwd ?? undefined,
          submittedAttachmentFileIds: dispatchEntry?.attachments_json?.map((attachment) => attachment.file_id),
          submittedQueuePosition: dispatchEntry?.queue_position,
        },
        deps,
      );
    } catch (err) {
      sessionLogger.warn(
        { err, event: "session.reattach.failed", session_id: session.id },
        "Failed to reattach orphaned session; marking disconnected",
      );
      deps.sessionService.store.remove(session.id);
      await removeDispatchStartedEntriesForSession(deps, session.id);
      await deps.sessionService.transitionStatus(session.id, "disconnected");
    }
  }
};
