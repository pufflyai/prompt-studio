import { getWriter, type SyncedRow } from "@/lib/sync/collections";
import {
  createDashboardSessions,
  createDashboardWorkspaces,
  type DashboardSession,
  type DashboardWorkspace,
} from "../data/dashboard-data";

interface DashboardWorkbenchRows {
  dashboardSessions: DashboardSession[];
  dashboardWorkspaces: DashboardWorkspace[];
}

const writeRows = (table: Parameters<typeof getWriter>[0], rows: SyncedRow[]) => {
  const writer = getWriter(table);
  if (!writer) throw new Error(`Missing writer for ${table}`);
  writer.truncateAndWrite(rows);
};

export const seedDashboardWorkbenchRows = (): DashboardWorkbenchRows => {
  writeRows("attempt_statuses", [
    { id: "status-running", project_id: "project-1", name: "Running", color: "blue", sort_order: 1 },
    { id: "status-review", project_id: "project-1", name: "Review", color: "purple", sort_order: 2 },
  ]);
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
  ]);
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
  ]);

  return {
    dashboardSessions: createDashboardSessions(),
    dashboardWorkspaces: createDashboardWorkspaces(),
  };
};
