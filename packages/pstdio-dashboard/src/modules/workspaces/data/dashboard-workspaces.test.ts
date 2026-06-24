import { describe, expect, test } from "bun:test";
import { buildDashboardWorkspacesFromRows, toWorkspaceRow } from "./dashboard-workspaces";

const rows = {
  files: [],
  sessions: [],
  workspaceSessions: [],
  workspaces: [
    {
      id: "workspace-1",
      project_id: "project-1",
      name: "Dashboard workbench datalayer",
      branch: "workspace/PS-307_A1",
      worktree_path: "/repo/.pstdio/workspaces/PS-307_A1",
      archived: false,
      workspace_shorthand: "PS-307_A1",
      setup_error: null,
      created_at: "2026-05-22T08:10:00Z",
      updated_at: "2026-05-22T08:50:00Z",
      deleted_at: null,
    },
    {
      id: "workspace-2",
      project_id: "project-2",
      name: "Other project workspace",
      branch: "main",
      worktree_path: null,
      archived: false,
      workspace_shorthand: "PS-999_A1",
      setup_error: null,
      created_at: "2026-05-21T08:10:00Z",
      updated_at: "2026-05-21T08:50:00Z",
      deleted_at: null,
    },
  ],
};

describe("dashboard workspaces", () => {
  test("maps synced workspace rows into workspace resources scoped to a project", () => {
    const workspaces = buildDashboardWorkspacesFromRows(rows, {
      projectId: "project-1",
      diffSummariesByWorkspaceId: new Map([
        ["workspace-1", { workspaceId: "workspace-1", additions: 83, deletions: 9, fileCount: 4 }],
      ]),
    });

    expect(workspaces).toHaveLength(1);
    expect(workspaces[0]).toMatchObject({
      id: "workspace-1",
      title: "Dashboard workbench datalayer",
      shorthand: "PS-307_A1",
      type: "worktree",
      additions: 83,
      deletions: 9,
      diffOverview: "+83 -9",
      diffFileCount: 4,
      resource: {
        kind: "workspace",
        id: "workspace-1",
        metadata: { workspaceId: "workspace-1", workspaceShorthand: "PS-307_A1", diffOverview: "+83 -9" },
      },
    });
  });

  test("sorts workspaces by creation time oldest first", () => {
    const workspaces = buildDashboardWorkspacesFromRows({
      ...rows,
      workspaces: [
        { ...rows.workspaces[0], id: "newest-workspace", created_at: "2026-05-23T08:10:00Z" },
        { ...rows.workspaces[0], id: "oldest-workspace", created_at: "2026-05-21T08:10:00Z" },
        { ...rows.workspaces[0], id: "middle-workspace", created_at: "2026-05-22T08:10:00Z" },
      ],
    });

    expect(workspaces.map((workspace) => workspace.id)).toEqual([
      "oldest-workspace",
      "middle-workspace",
      "newest-workspace",
    ]);
  });

  test("carries the workspace branch in resource metadata so workspace sessions stay bound to it", () => {
    const [workspace] = buildDashboardWorkspacesFromRows(rows, { projectId: "project-1" });

    expect(workspace.resource.metadata).toMatchObject({ workspaceBranch: "workspace/PS-307_A1" });
  });

  test("carries ticket anchors in resource metadata so breadcrumbs stay ticket-scoped", () => {
    const [workspace] = buildDashboardWorkspacesFromRows(
      {
        ...rows,
        workspaces: [
          {
            ...rows.workspaces[0],
            anchors_json: [
              {
                type: "ticket",
                id: "ticket-1",
                label: "PS-307",
                metadata: { shorthand: "PS-307" },
              },
            ],
          },
        ],
      },
      { projectId: "project-1" },
    );

    expect(workspace.resource.metadata).toMatchObject({
      ticketId: "ticket-1",
      ticketLabel: "PS-307",
      ticketShorthand: "PS-307",
    });
  });

  test("carries planner ticket breadcrumb anchors into workspace resource metadata", () => {
    const [workspace] = buildDashboardWorkspacesFromRows(
      {
        ...rows,
        workspaces: [
          {
            ...rows.workspaces[0],
            anchors_json: [
              {
                type: "ticket",
                id: "ticket-child",
                label: "PS-308",
                metadata: {
                  shorthand: "PS-308",
                  ticketBreadcrumb: [
                    { id: "ticket-parent", label: "PS-307 Parent", shorthand: "PS-307" },
                    { id: "ticket-child", label: "PS-308 Child", shorthand: "PS-308" },
                  ],
                },
              },
            ],
          },
        ],
      },
      { projectId: "project-1" },
    );

    expect(workspace.resource.metadata).toMatchObject({
      ticketId: "ticket-child",
      ticketLabel: "PS-308",
      ticketShorthand: "PS-308",
      ticketBreadcrumb: [
        { id: "ticket-parent", label: "PS-307 Parent", shorthand: "PS-307" },
        { id: "ticket-child", label: "PS-308 Child", shorthand: "PS-308" },
      ],
    });
  });

  test("maps a workspace into a board row with diff attributes", () => {
    const [workspace] = buildDashboardWorkspacesFromRows(rows, {
      projectId: "project-1",
      diffSummariesByWorkspaceId: new Map([
        ["workspace-1", { workspaceId: "workspace-1", additions: 0, deletions: 0, fileCount: 0 }],
      ]),
    });

    expect(toWorkspaceRow(workspace)).toMatchObject({
      id: "dashboard-workbench://workspace/workspace-1",
      title: "Dashboard workbench datalayer",
      attributes: { id: "PS-307_A1", type: "worktree", diffOverview: "+0 -0", diffAdditions: 0, diffDeletions: 0 },
    });
  });

  test("omits diff attributes when no summary is available", () => {
    const [workspace] = buildDashboardWorkspacesFromRows(rows, { projectId: "project-1" });

    expect(toWorkspaceRow(workspace).attributes).not.toHaveProperty("diffOverview");
  });
});
