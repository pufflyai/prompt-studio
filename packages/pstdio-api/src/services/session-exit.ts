import type { SessionExitCause } from "pstdio-api-contracts/extension-kernel";
import type { createActivityEventsDBService } from "pstdio-db";

type Activity = ReturnType<typeof createActivityEventsDBService>;
export const readSessionExit = async (
  activity: Activity,
  session: {
    id: string;
    project_id: string;
    last_request_started: string | null;
    last_request_ended: string | null;
  },
) => {
  if (!session.last_request_ended) return null;
  const page = await activity.listByResource({
    projectId: session.project_id,
    resourceType: "session",
    resourceId: session.id,
    eventType: "session_execution_ended",
    limit: 1,
  });
  const payload = page.events[0]?.payload_json;
  if (!payload || payload.endedAt !== session.last_request_ended || payload.startedAt !== session.last_request_started)
    return null;
  return {
    cause: payload.cause as SessionExitCause,
    startedAt: session.last_request_started,
    endedAt: session.last_request_ended,
  };
};
