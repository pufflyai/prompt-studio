import { getWriter, markInitialCollectionsSyncComplete } from "@/lib/sync/collections";

export const seedSidenavStory = (projectId: string) => {
  getWriter("settings")?.truncateAndWrite([
    { id: "global", max_concurrent_sessions: null, notifications_enabled: true },
  ]);
  getWriter("sessions")?.truncateAndWrite([
    sessionRow(projectId, "session-today-1", "Refactor sidenav", "completed", "2026-06-24T09:00:00Z", "workspace-1"),
    sessionRow(projectId, "session-today-2", "Investigate flaky test", "failed", "2026-06-24T08:00:00Z"),
    sessionRow(projectId, "session-yesterday", "Wire up board", "completed", "2026-06-23T15:00:00Z", "workspace-1"),
  ]);
  getWriter("workspaces")?.truncateAndWrite([
    {
      id: "workspace-1",
      project_id: projectId,
      name: "Mode-driven sidenav",
      branch: "feature/PS-107",
      root_path: "/repo/.pstdio/workspaces/PS-107",
      archived: false,
      workspace_shorthand: "PS-107_A1",
      setup_error: null,
      created_at: "2026-06-22T08:10:00Z",
      updated_at: "2026-06-24T09:00:00Z",
      deleted_at: null,
    },
  ]);
  getWriter("notifications")?.truncateAndWrite([
    {
      id: "notification-1",
      project_id: projectId,
      title: "Review generated ticket summary",
      body: "The planner has an update ready for review.",
      kind: "needs_review",
      priority: "normal",
      status: "open",
      source: "dashboard",
      origin: "core",
      source_extension_id: null,
      actor_type: "agent",
      actor_id: null,
      target_json: null,
      related_json: [],
      actions_json: [],
      dedupe_key: "story-notification",
      metadata_json: null,
      created_at: "2026-06-24T09:30:00Z",
      updated_at: "2026-06-24T09:30:00Z",
      read_at: null,
      resolved_at: null,
      snoozed_until: null,
      expires_at: null,
    },
  ]);
  getWriter("board_views")?.truncateAndWrite([]);
  getWriter("board_default_views")?.truncateAndWrite([]);
  markInitialCollectionsSyncComplete();
};
const sessionRow = (
  projectId: string,
  id: string,
  title: string,
  status: string,
  updatedAt: string,
  workspaceId?: string,
) => ({
  id,
  project_id: projectId,
  title,
  status,
  agent: null,
  last_selected_model: null,
  archived: false,
  last_request_started: updatedAt,
  last_request_ended: updatedAt,
  created_at: updatedAt,
  updated_at: updatedAt,
  deleted_at: null,
  ...(workspaceId ? { workspace_id: workspaceId } : {}),
});
