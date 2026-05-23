import { describe, expect, test } from "bun:test";
import { buildDashboardWorkspacesFromRows, toWorkspaceRow } from "./dashboard-data";

const rows = {
  attemptStatuses: [
    {
      id: "status-review",
      project_id: "project-1",
      name: "Review",
      color: "purple",
      sort_order: 1,
      is_default: false,
      created_at: "2026-05-22T08:00:00Z",
      updated_at: "2026-05-22T08:00:00Z",
      deleted_at: null,
    },
  ],
  sessions: [
    {
      id: "session-1",
      project_id: "project-1",
      title: "Review dashboard workbench",
      status: "completed",
      archived: false,
      agent: "opencode",
      agent_session_id: "agent-session-1",
      last_selected_model: "openai/gpt-5.5",
      created_at: "2026-05-22T08:15:00Z",
      updated_at: "2026-05-22T08:45:00Z",
    },
  ],
  workspaceSessions: [
    {
      id: "workspace-session-1",
      workspace_id: "workspace-1",
      session_id: "session-1",
      created_at: "2026-05-22T08:15:00Z",
    },
  ],
  ticketWorkspaces: [
    {
      id: "ticket-workspace-1",
      ticket_id: "ticket-1",
      workspace_id: "workspace-1",
      created_at: "2026-05-22T08:10:00Z",
    },
  ],
  files: [
    {
      id: "file-validate",
      project_id: "project-1",
      file_name: "validate-pass.log",
      file_kind: "artifact",
      storage_path: "projects/project-1/files/file-validate",
      mime_type: "text/plain",
      size_bytes: 120,
      hash: "hash-validate",
      created_at: "2026-05-22T08:20:00Z",
      updated_at: "2026-05-22T08:30:00Z",
    },
  ],
  workspaceArtifacts: [
    {
      id: "artifact-validate",
      ticket_id: "ticket-1",
      file_id: "file-validate",
      relative_path: "artifacts/checks/validate-pass.log",
      created_at: "2026-05-22T08:20:00Z",
    },
  ],
  workspaces: [
    {
      id: "workspace-1",
      project_id: "project-1",
      name: "Dashboard workbench datalayer",
      branch: "workspace/PS-307_A1",
      worktree_path: "/repo/.pstdio/workspaces/PS-307_A1",
      attempt_status_id: "status-review",
      archived: false,
      workspace_shorthand: "PS-307_A1",
      initializing: false,
      setup_error: null,
      created_at: "2026-05-22T08:10:00Z",
      updated_at: "2026-05-22T08:50:00Z",
      deleted_at: null,
    },
  ],
};

describe("dashboard data selectors", () => {
  test("maps synced workspace rows into workbench workspace resources", () => {
    const [workspace] = buildDashboardWorkspacesFromRows(rows);

    expect(workspace).toMatchObject({
      id: "workspace-1",
      title: "Dashboard workbench datalayer",
      shorthand: "PS-307_A1",
      type: "worktree",
      status: { name: "Review", color: "purple" },
      ticketId: "ticket-1",
      resource: {
        kind: "workspace",
        id: "workspace-1",
        label: "Dashboard workbench datalayer",
      },
      sessions: [
        {
          id: "session-1",
          title: "Review dashboard workbench",
          agent: "opencode",
          lastSelectedModel: "openai/gpt-5.5",
          workspaceId: "workspace-1",
          workspaceBranch: "workspace/PS-307_A1",
          workspaceShorthand: "PS-307_A1",
        },
      ],
      review: {
        ticketId: "ticket-1",
        checks: [
          {
            id: "artifact-validate",
            fileId: "file-validate",
            label: "checks/validate-pass.log",
            status: "passed",
          },
        ],
      },
    });
  });

  test("maps synced workspace rows into workspace board rows", () => {
    const [workspace] = buildDashboardWorkspacesFromRows(rows);

    expect(toWorkspaceRow(workspace)).toMatchObject({
      id: "dashboard-workbench://workspace/workspace-1",
      ticketId: "PS-307_A1",
      title: "Dashboard workbench datalayer",
      status: "review",
      statusColor: "purple",
      tags: [{ name: "type", value: "worktree" }],
      resource: workspace.resource,
    });
  });
});
