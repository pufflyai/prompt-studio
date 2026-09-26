import type { SessionsRouteDeps } from "./deps";
import { dispatchQueuedEntry } from "./session-queue-dispatch";
import { isWorkspaceDispatchPending } from "./session-queue-readiness";
import { hasCreateCapacity, withSchedulingLock } from "./session-scheduler-internals";

const isTerminal = (status: string) =>
  status === "completed" || status === "failed" || status === "cancelled" || status === "disconnected";

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
    await withSchedulingLock(async () => {
      if (input?.releasedSessionId) {
        await maybeRequeueReleasedSession(input.releasedSessionId);
      }

      const pending = await deps.sessionQueueEntriesService.listPending();
      for (const entry of pending) {
        if (!(await hasCreateCapacity(deps))) return;

        const session = await deps.sessionService.get(entry.session_id);
        if (!session || session.status !== "queued") {
          // Pending entries can coexist with non-queued sessions (multi-pending follow-ups).
          // Skip without side-effect; markDispatchStarted would permanently orphan the entry.
          continue;
        }

        const workspace = await deps.workspaceSessionService.getWorkspaceBySessionId(session.id);
        if (isWorkspaceDispatchPending(workspace)) continue;
        const dispatch = await dispatchQueuedEntry(deps, session, entry);
        dispatches.push(dispatch?.settled);
      }
    }).finally(async () => {
      // Failed startups can drain released capacity, so settle outside the scheduling lock.
      const results = await Promise.allSettled(dispatches);
      const failed = results.find((result) => result.status === "rejected");
      if (failed) throw failed.reason;
    });
  };

  return (input?: { releasedSessionId?: string }) => deps.sessionQueueLifecycle.run(() => drain(input));
};
