import { sessionEvents } from "pstdio-api-contracts/extension-kernel";
import { fireSessionLifecycleEvent } from "../features/hooks/session-hooks";

export const createSessionLifecycleCallbacks = (getDeps: () => Parameters<typeof fireSessionLifecycleEvent>[0]) => {
  const controller = new AbortController();
  const pending = new Set<Promise<void>>();
  const dispatch = (
    event: Parameters<typeof fireSessionLifecycleEvent>[1],
    session: Parameters<typeof fireSessionLifecycleEvent>[2],
  ) => {
    if (controller.signal.aborted) return;
    const task = fireSessionLifecycleEvent(getDeps(), event, session, controller.signal);
    pending.add(task);
    void task.then(() => pending.delete(task));
  };
  return {
    onSessionStarted: (session: Parameters<typeof fireSessionLifecycleEvent>[2]) =>
      dispatch(sessionEvents.started, session),
    onSessionStatusChanged: (session: Parameters<typeof fireSessionLifecycleEvent>[2]) => {
      for (const event of sessionStatusEventsFor(session.status)) dispatch(event, session);
    },
    onSessionResumed: (session: Parameters<typeof fireSessionLifecycleEvent>[2]) =>
      dispatch(sessionEvents.resumed, session),
    async close() {
      // Payload resolution reads project data before the extension runtime sees the event.
      controller.abort();
      await Promise.all(pending);
    },
  };
};

// Completion covers every ended run; narrower events keep the outcome-specific hooks.
export const sessionStatusEventsFor = (status: string) => {
  if (status === "awaiting_input") return [sessionEvents.awaitingInput];
  if (status === "completed") return [sessionEvents.succeeded, sessionEvents.completed];
  if (status === "failed") return [sessionEvents.failed, sessionEvents.completed];
  if (status === "cancelled" || status === "disconnected") return [sessionEvents.completed];
  return [];
};
