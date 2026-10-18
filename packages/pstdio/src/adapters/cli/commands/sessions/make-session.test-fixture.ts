import type { Session } from "@pstdio/sdk/resources";

export const makeSession = (overrides: Partial<Session> = {}) => {
  const row: Session = {
    id: "s_abc123",
    project_id: "proj-1",
    title: "Test",
    status: "in_progress",
    archived: false,
    last_request_started: "2026-03-05T10:00:00Z",
    last_request_ended: null,
    agent: "claude-code",
    last_selected_model: null,
    agent_session_id: null,
    session_file_id: null,
    original_session_id: null,
    cwd: null,
    anchors_json: [],
    params_json: null,
    created_at: "2026-03-05T10:00:00Z",
    updated_at: "2026-03-05T10:00:00Z",
    ...overrides,
  };
  return {
    ...row,
    projectId: row.project_id,
    agentSessionId: row.agent_session_id,
    sessionFileId: row.session_file_id,
    params: row.params_json,
    lastSelectedModel: row.last_selected_model,
    workspaceId: row.workspace_id ?? null,
    originalSessionId: row.original_session_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastRequestStarted: row.last_request_started,
    lastRequestEnded: row.last_request_ended,
    usage: null,
  };
};
