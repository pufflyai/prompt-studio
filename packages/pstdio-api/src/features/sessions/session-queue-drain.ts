import { sessionLogger } from "../../lib/logger";
import { ProjectRemovalInProgress } from "../../services/project-work";
import { workspaceSessionReadiness } from "../workspaces/workspace-session-readiness";
import type { SessionsRouteDeps } from "./deps";
import { dispatchQueuedEntry } from "./session-queue-dispatch";
import { hasCreateCapacity, withSchedulingLock } from "./session-scheduler-internals";

const isTerminal = (status: string) =>
  status === "completed" || status === "failed" || status === "cancelled" || status === "disconnected";

type QueueDrainInput = { releasedSessionId?: string; queuePositions?: ReadonlySet<number> };

const admitQueuedDispatch = async (...args: Parameters<typeof dispatchQueuedEntry>) => {
  const [deps, session] = args;
  const work = deps.projectService?.work;
  try {
    return work && session.project_id
      ? await work.run(session.project_id, () => dispatchQueuedEntry(...args))
      : await dispatchQueuedEntry(...args);
  } catch (error) {
    if (!(error instanceof ProjectRemovalInProgress)) throw error;
  }
};

export const createSessionQueueDrain = (deps: SessionsRouteDeps) => {
  const removing = (id: string | null) => id && deps.projectService?.work?.blocked(id);
  const maybeRequeueReleasedSession = async (sessionId: string) => {
    const session = await deps.sessionService.get(sessionId);
    if (!session || removing(session.project_id) || !isTerminal(session.status) || session.status === "cancelled")
      return;

    const pending = await deps.sessionQueueEntriesService.listPendingBySession(sessionId);
    if (pending.length === 0) return;

    await deps.sessionService.requeueAfterTerminal(sessionId);
  };

  const drain = async (input?: QueueDrainInput) => {
    const dispatches: (Promise<unknown> | undefined)[] = [];
    const dispatchPending = async () => {
      const pending = await withSchedulingLock(async () => {
        if (input?.releasedSessionId) {
          await maybeRequeueReleasedSession(input.releasedSessionId);
        }
        return deps.sessionQueueEntriesService.listPending();
      });
      for (const entry of pending) {
        if (input?.queuePositions && !input.queuePositions.has(entry.queue_position)) continue;
        // Pending entries can coexist with non-queued sessions (multi-pending follow-ups).
        // Skip without side-effect; markDispatchStarted would permanently orphan the entry.
        const queued = await deps.sessionService.get(entry.session_id);
        if (!queued || queued.status !== "queued") continue;
        const hasCapacity = await withSchedulingLock(async () => {
          const session = await deps.sessionService.get(entry.session_id);
          if (session?.status !== "queued" || removing(session.project_id)) return true;
          const workspace = await deps.workspaceSessionService.getWorkspaceBySessionId(session.id, { forLaunch: true });
          if (!(await hasCreateCapacity(deps, workspace?.id))) return false;
          // Lifecycle changes and quiet maintenance settlement both wake the queue when it becomes ready.
          if (workspaceSessionReadiness(workspace).kind === "wait") return true;
          dispatches.push((await admitQueuedDispatch(deps, session, entry))?.settled);
          return true;
        });
        if (!hasCapacity) continue;
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

  return (input?: QueueDrainInput) => deps.sessionQueueLifecycle.run(() => drain(input));
};
