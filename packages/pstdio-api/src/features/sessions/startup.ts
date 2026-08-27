import { sessionLogger } from "../../lib/logger";
import type { SessionsRouteDeps } from "./deps";
import { getSessionHarness } from "./get-session-harness";
import { reattachAgentSession, WorkspaceSessionNotReadyError } from "./spawn-agent";

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
    if (entry.session_id === sessionId) await deps.sessionQueueEntriesService.remove(entry.queue_position);
  }
};

const getDispatchStartedEntryForSession = async (deps: Deps, sessionId: string) => {
  const entries = await deps.sessionQueueEntriesService.listDispatchStarted();
  return entries.find((entry) => entry.session_id === sessionId);
};

type OrphanedSession = Awaited<ReturnType<Deps["sessionService"]["listByStatus"]>>[number];

const reattachOrphanedSession = async (deps: Deps, session: OrphanedSession, signal?: AbortSignal) => {
  const dispatchEntry = await getDispatchStartedEntryForSession(deps, session.id);
  let lastError: unknown;
  for (let attempt = 0; attempt < 3 && !signal?.aborted; attempt += 1) {
    try {
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
      return;
    } catch (error) {
      lastError = error;
      deps.sessionService.store.remove(session.id);
      if (attempt < 2) await Bun.sleep(250);
    }
  }
  if (lastError) throw lastError;
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
      (await harness.capabilities({ projectId: session.project_id ?? undefined })).includes("SessionReattach") &&
      session.agent_session_id;

    if (!canReattach) {
      await deps.sessionService.transitionStatus(session.id, "disconnected");
      continue;
    }

    try {
      await reattachOrphanedSession(deps, session, signal);
    } catch (err) {
      if (err instanceof WorkspaceSessionNotReadyError && !err.retryable) {
        deps.sessionService.store.remove(session.id);
        await removeDispatchStartedEntriesForSession(deps, session.id);
        await deps.sessionService.transitionStatus(session.id, "disconnected");
        continue;
      }
      sessionLogger.warn(
        { err, event: "session.reattach.failed", session_id: session.id },
        "Failed to reattach orphaned session; leaving it active for recovery",
      );
      deps.sessionService.store.remove(session.id);
    }
  }
};
