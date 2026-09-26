import type { SessionsRouteDeps } from "./deps";
import { getSessionHistory, SessionHistoryError } from "./session-history";
import { dispatchQueuedEntry } from "./session-queue-dispatch";
import { isWorkspaceDispatchPending } from "./session-queue-readiness";
import {
  type ExistingSession,
  hasCreateCapacity,
  type PendingQueueEntry,
  withSchedulingLock,
} from "./session-scheduler-internals";

const isTerminal = (status: string) =>
  status === "completed" || status === "failed" || status === "cancelled" || status === "disconnected";

// A resume waits while its native history conflicts, so the queued prompt is not lost.
const hasDispatchableHistory = async (deps: SessionsRouteDeps, session: ExistingSession, entry: PendingQueueEntry) => {
  if (!session.agent_session_id || entry.request_kind === "start") return true;
  try {
    const history = await getSessionHistory(session.id, deps);
    return !history.historyIssue || history.historyIssue.code === "native_unavailable";
  } catch (error) {
    if (error instanceof SessionHistoryError) return false;
    throw error;
  }
};

export const createSessionQueueDrain = (deps: SessionsRouteDeps) => {
  const maybeRequeueReleasedSession = async (sessionId: string) => {
    const session = await deps.sessionService.get(sessionId);
    if (!session || !isTerminal(session.status) || session.status === "cancelled") return;

    const pending = await deps.sessionQueueEntriesService.listPendingBySession(sessionId);
    if (pending.length === 0) return;

    await deps.sessionService.requeueAfterTerminal(sessionId);
  };

  const drain = async (input?: { releasedSessionId?: string }) => {
    const dispatches: (Promise<unknown> | undefined)[] = [];
    try {
      const pending = await withSchedulingLock(async () => {
        if (input?.releasedSessionId) {
          await maybeRequeueReleasedSession(input.releasedSessionId);
        }
        return deps.sessionQueueEntriesService.listPending();
      });
      for (const entry of pending) {
        // Pending entries can coexist with non-queued sessions (multi-pending follow-ups).
        // Skip without side-effect; markDispatchStarted would permanently orphan the entry.
        const queued = await deps.sessionService.get(entry.session_id);
        if (!queued || queued.status !== "queued") continue;
        // Native history reads stay outside the scheduling lock.
        if (!(await hasDispatchableHistory(deps, queued, entry))) continue;
        const hasCapacity = await withSchedulingLock(async () => {
          if (!(await hasCreateCapacity(deps))) return false;
          const session = await deps.sessionService.get(entry.session_id);
          if (session?.status !== "queued") return true;
          const workspace = await deps.workspaceSessionService.getWorkspaceBySessionId(session.id);
          if (isWorkspaceDispatchPending(workspace)) return true;
          const dispatch = await dispatchQueuedEntry(deps, session, entry);
          dispatches.push(dispatch?.settled);
          return true;
        });
        if (!hasCapacity) return;
      }
    } finally {
      // Failed startups can drain released capacity, so settle outside the scheduling lock.
      const results = await Promise.allSettled(dispatches);
      const failed = results.find((result) => result.status === "rejected");
      if (failed) throw failed.reason;
    }
  };

  return (input?: { releasedSessionId?: string }) => deps.sessionQueueLifecycle.run(() => drain(input));
};
