import type { ExtensionSessionsApi } from "@pstdio/sdk/extensions";

type Session = Awaited<ReturnType<ExtensionSessionsApi["create"]>>;

export const sessionRecord = (input: Pick<Session, "id" | "title" | "status"> & Partial<Session>) => ({
  type: "session" as const,
  archived: false,
  agent: null,
  cwd: null,
  lastSelectedModel: null,
  workspaceId: null,
  originalSessionId: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  lastRequestStarted: null,
  lastRequestEnded: null,
  last_selected_model: null,
  workspace_id: null,
  original_session_id: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  last_request_started: null,
  last_request_ended: null,
  anchors_json: [],
  usage: null,
  ...input,
});
