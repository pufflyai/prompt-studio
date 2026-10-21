import type { createSessionService } from "../../services/session-service";

type SessionRow = NonNullable<Awaited<ReturnType<ReturnType<typeof createSessionService>["get"]>>> & {
  device?: { ownerId: string; id: string; name: string };
};
export const toExtensionSession = (session: SessionRow, workspaceId: string | null = null) => ({
  id: session.id,
  ...(session.device ? { device: session.device } : {}),
  title: session.title,
  status: session.status,
  archived: session.archived,
  agent: session.agent,
  lastSelectedModel: session.last_selected_model,
  workspaceId,
  originalSessionId: session.original_session_id,
  createdAt: session.created_at,
  updatedAt: session.updated_at,
  lastRequestStarted: session.last_request_started,
  lastRequestEnded: session.last_request_ended,
  last_selected_model: session.last_selected_model,
  workspace_id: workspaceId,
  original_session_id: session.original_session_id,
  cwd: session.cwd,
  created_at: session.created_at,
  updated_at: session.updated_at,
  last_request_started: session.last_request_started,
  last_request_ended: session.last_request_ended,
  anchors_json: session.anchors_json ?? [],
  usage: session.usage_json
    ? {
        ...session.usage_json,
        inputTokens: session.usage_json.input_tokens,
        outputTokens: session.usage_json.output_tokens,
        cacheReadTokens: session.usage_json.cache_read_tokens,
        cacheWriteTokens: session.usage_json.cache_write_tokens,
      }
    : null,
});
