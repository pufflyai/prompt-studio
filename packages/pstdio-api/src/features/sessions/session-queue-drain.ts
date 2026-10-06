import { sessionLogger } from "../../lib/logger";
import { workspaceSessionReadiness } from "../workspaces/workspace-session-readiness";
import type { SessionsRouteDeps } from "./deps";
import { dispatchQueuedEntry } from "./session-queue-dispatch";
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
    const dispatchPending = async () => {
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
        const hasCapacity = await withSchedulingLock(async () => {
          if (!(await hasCreateCapacity(deps))) return false;
          const session = await deps.sessionService.get(entry.session_id);
          if (session?.status !== "queued") return true;
          const workspace = await deps.workspaceSessionService.getWorkspaceBySessionId(session.id);
          // A workspace that will become ready keeps the entry pending; its `set` event drains again.
          if (workspaceSessionReadiness(workspace).kind === "wait") return true;
          const dispatch = await dispatchQueuedEntry(deps, session, entry);
          dispatches.push(dispatch?.settled);
          return true;
        });
        if (!hasCapacity) return;
      }
    };
    await dispatchPending().finally(async () => {
      // Failed startups can drain released capacity, so settle outside the scheduling lock.
      const results = await Promise.allSettled(dispatches);
      // A dispatch failure belongs to its own session. It must not fail the status change or
      // settings update that started this drain.
      for (const result of results) {
        if (result.status === "rejected") {
          sessionLogger.error(
            { err: result.reason, event: "session.queue.dispatch_failed" },
            "Queued session dispatch failed",
          );
        }
      }
    });
  };

  return (input?: { releasedSessionId?: string }) => deps.sessionQueueLifecycle.run(() => drain(input));
};
