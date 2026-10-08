import { sessionEvents } from "pstdio-api-contracts/extension-kernel";
import { fireSessionLifecycleEventAsync } from "../features/hooks/session-hooks";
export const createSessionLifecycleCallbacks = (
  getDeps: () => Parameters<typeof fireSessionLifecycleEventAsync>[0],
) => ({
  onSessionStarted: (session: {
    id: string;
    project_id: string;
    status: string;
    original_session_id?: string | null;
  }) => {
    fireSessionLifecycleEventAsync(getDeps(), sessionEvents.started, session);
  },
  onSessionStatusChanged: (session: {
    id: string;
    project_id: string;
    status: string;
    original_session_id?: string | null;
  }) => {
    for (const event of sessionStatusEventsFor(session.status)) {
      fireSessionLifecycleEventAsync(getDeps(), event, session);
    }
  },
  onSessionResumed: (session: {
    id: string;
    project_id: string;
    status: string;
    original_session_id?: string | null;
  }) => {
    fireSessionLifecycleEventAsync(getDeps(), sessionEvents.resumed, session);
  },
});

// Completion covers every ended run; narrower events keep the outcome-specific hooks.
export const sessionStatusEventsFor = (status: string) => {
  if (status === "awaiting_input") return [sessionEvents.awaitingInput];
  if (status === "completed") return [sessionEvents.succeeded, sessionEvents.completed];
  if (status === "failed") return [sessionEvents.failed, sessionEvents.completed];
  if (status === "cancelled" || status === "disconnected") return [sessionEvents.completed];
  return [];
};
