import { getWriter, type SyncedRow } from "@/lib/sync/collections";
import { createDashboardSessions } from "../modules/sessions/data/dashboard-sessions";
import { createDashboardWorkspaces } from "../modules/workspaces/data/dashboard-workspaces";

const writeRows = (table: Parameters<typeof getWriter>[0], rows: SyncedRow[]) => {
  const writer = getWriter(table);
  if (!writer) throw new Error(`Missing writer for ${table}`);
  writer.truncateAndWrite(rows);
};

const seedProjectRows = () => {
  writeRows("projects", [
    {
      id: "project-1",
      name: "Prompt Studio",
      created_at: "2026-05-20T08:00:00Z",
      updated_at: "2026-05-20T09:00:00Z",
      deleted_at: null,
    },
    {
      id: "project-2",
      name: "Datazine",
      created_at: "2026-05-21T08:00:00Z",
      updated_at: "2026-05-21T09:00:00Z",
      deleted_at: null,
    },
  ]);
  writeRows("repos", [
    { id: "repo-1", path: "/repo/prompt-studio", deleted_at: null },
    { id: "repo-2", path: "/repo/datazine", deleted_at: null },
  ]);
  writeRows("project_repos", [
    { id: "project-repo-1", project_id: "project-1", repo_id: "repo-1" },
    { id: "project-repo-2", project_id: "project-2", repo_id: "repo-2" },
  ]);
};

const seedWorkspaceRows = () => {
  writeRows("workspaces", [
    {
      id: "workspace-1",
      project_id: "project-1",
      name: "Dashboard workbench shell",
      worktree_path: "/repo/.pstdio/workspaces/PS-307_A1",
      attempt_status_id: "status-running",
      archived: false,
      workspace_shorthand: "PS-307_A1",
      initializing: false,
      setup_error: null,
      updated_at: "2026-05-22T08:50:00Z",
    },
    {
      id: "workspace-2",
      project_id: "project-1",
      name: "Sessions mode extraction",
      worktree_path: "/repo/.pstdio/workspaces/PS-307_A2",
      attempt_status_id: "status-review",
      archived: false,
      workspace_shorthand: "PS-307_A2",
      initializing: false,
      setup_error: null,
      updated_at: "2026-05-21T16:20:00Z",
    },
    {
      id: "workspace-3",
      project_id: "project-2",
      name: "Datazine ingestion",
      worktree_path: "/repo/.pstdio/workspaces/D-12_A1",
      attempt_status_id: "status-datazine",
      archived: false,
      workspace_shorthand: "D-12_A1",
      initializing: false,
      setup_error: null,
      updated_at: "2026-05-20T12:00:00Z",
    },
  ]);
  writeRows("files", [
    {
      id: "file-validate",
      project_id: "project-1",
      file_name: "validate-pass.log",
      file_kind: "artifact",
      storage_path: "projects/project-1/files/file-validate",
      mime_type: "text/plain",
      size_bytes: 1024,
      created_at: "2026-05-22T08:52:00Z",
      updated_at: "2026-05-22T08:55:00Z",
    },
    {
      id: "file-lint",
      project_id: "project-1",
      file_name: "lint-error.log",
      file_kind: "artifact",
      storage_path: "projects/project-1/files/file-lint",
      mime_type: "text/plain",
      size_bytes: 512,
      created_at: "2026-05-21T16:22:00Z",
      updated_at: "2026-05-21T16:25:00Z",
    },
    {
      id: "file-datazine-validate",
      project_id: "project-2",
      file_name: "validate-success.log",
      file_kind: "artifact",
      storage_path: "projects/project-2/files/file-datazine-validate",
      mime_type: "text/plain",
      size_bytes: 768,
      created_at: "2026-05-20T12:02:00Z",
      updated_at: "2026-05-20T12:04:00Z",
    },
  ]);
};

const seedSessionRows = () => {
  writeRows("sessions", [
    {
      id: "session-shell-review",
      project_id: "project-1",
      title: "Review dashboard shell migration",
      status: "in_progress",
      archived: false,
      updated_at: "2026-05-22T08:55:00Z",
      created_at: "2026-05-22T08:45:00Z",
    },
    {
      id: "session-sidebar-parity",
      project_id: "project-1",
      title: "Match workspace sidebar behavior",
      status: "completed",
      archived: false,
      updated_at: "2026-05-22T07:10:00Z",
      created_at: "2026-05-22T07:00:00Z",
    },
    {
      id: "session-list-mode",
      project_id: "project-1",
      title: "Move sessions into a dedicated mode",
      status: "awaiting_input",
      archived: false,
      updated_at: "2026-05-21T16:40:00Z",
      created_at: "2026-05-21T16:30:00Z",
    },
    {
      id: "session-datazine-ingestion",
      project_id: "project-2",
      title: "Wire Datazine ingestion",
      status: "queued",
      archived: false,
      updated_at: "2026-05-20T12:10:00Z",
      created_at: "2026-05-20T12:05:00Z",
    },
  ]);
  writeRows("workspace_sessions", [
    {
      id: "workspace-session-1",
      workspace_id: "workspace-1",
      session_id: "session-shell-review",
      created_at: "2026-05-22T08:45:00Z",
    },
    {
      id: "workspace-session-2",
      workspace_id: "workspace-1",
      session_id: "session-sidebar-parity",
      created_at: "2026-05-22T07:00:00Z",
    },
    {
      id: "workspace-session-3",
      workspace_id: "workspace-2",
      session_id: "session-list-mode",
      created_at: "2026-05-21T16:30:00Z",
    },
    {
      id: "workspace-session-4",
      workspace_id: "workspace-3",
      session_id: "session-datazine-ingestion",
      created_at: "2026-05-20T12:05:00Z",
    },
  ]);
};

export const seedDashboardWorkbenchRows = () => {
  seedProjectRows();
  seedWorkspaceRows();
  seedSessionRows();

  return {
    dashboardSessions: createDashboardSessions(),
    dashboardWorkspaces: createDashboardWorkspaces(),
  };
};
