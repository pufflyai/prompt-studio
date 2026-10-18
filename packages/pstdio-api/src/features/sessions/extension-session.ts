import type { createSessionService } from "../../services/session-service";

type SessionRow = NonNullable<Awaited<ReturnType<ReturnType<typeof createSessionService>["get"]>>>;
export const toExtensionSession = (session: SessionRow, workspaceId: string | null = null) => ({
  id: session.id,
  title: session.title,
  status: session.status,
  archived: session.archived,
  agent: session.agent,
  last_selected_model: session.last_selected_model,
  workspace_id: workspaceId,
  original_session_id: session.original_session_id,
  cwd: session.cwd,
  created_at: session.created_at,
  updated_at: session.updated_at,
  last_request_started: session.last_request_started,
  last_request_ended: session.last_request_ended,
  anchors_json: session.anchors_json ?? [],
  usage: session.usage_json,
});
