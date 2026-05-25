import { describe, expect, test } from "bun:test";
import { buildDashboardWorkspacesFromRows, toWorkspaceRow } from "./dashboard-workspaces";

const rows = {
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
    const [workspace] = buildDashboardWorkspacesFromRows(rows, {
      diffSummariesByWorkspaceId: new Map([
        ["workspace-1", { workspaceId: "workspace-1", additions: 83, deletions: 9, fileCount: 4 }],
      ]),
    });

    expect(workspace).toMatchObject({
      id: "workspace-1",
      title: "Dashboard workbench datalayer",
      shorthand: "PS-307_A1",
      type: "worktree",
      ticketId: "ticket-1",
      resource: {
        kind: "workspace",
        id: "workspace-1",
        label: "Dashboard workbench datalayer",
        metadata: {
          workspaceId: "workspace-1",
          workspaceShorthand: "PS-307_A1",
          ticket: "PS-307",
          ticketId: "ticket-1",
          diffOverview: "+83 -9",
          diffAdditions: 83,
          diffDeletions: 9,
          diffFileCount: 4,
        },
      },
      additions: 83,
      deletions: 9,
      diffOverview: "+83 -9",
      diffFileCount: 4,
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
    const [workspace] = buildDashboardWorkspacesFromRows(rows, {
      diffSummariesByWorkspaceId: new Map([
        ["workspace-1", { workspaceId: "workspace-1", additions: 0, deletions: 0, fileCount: 0 }],
      ]),
    });

    expect(toWorkspaceRow(workspace)).toMatchObject({
      id: "dashboard-workbench://workspace/workspace-1",
      title: "Dashboard workbench datalayer",
      resource: workspace.resource,
      attributes: {
        id: "PS-307_A1",
        type: "worktree",
        diffOverview: "+0 -0",
        diffAdditions: 0,
        diffDeletions: 0,
        diffFileCount: 0,
      },
    });
  });
});
