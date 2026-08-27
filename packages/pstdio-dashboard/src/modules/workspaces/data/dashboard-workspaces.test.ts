import { describe, expect, test } from "bun:test";
import { buildDashboardWorkspacesFromRows, toWorkspaceDataTableRow } from "./dashboard-workspaces";

const rows = {
  files: [],
  projectRepos: [
    { id: "project-repo-1", project_id: "project-1", repo_id: "repo-1" },
    { id: "project-repo-2", project_id: "project-1", repo_id: "repo-2" },
  ],
  repos: [
    { id: "repo-1", path: "/repo/prompt-studio" },
    { id: "repo-2", path: "/repo/other" },
  ],
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
        metadata: {
          diffOverview: "+83 -9",
          workspaceId: "workspace-1",
          workspacePath: "/repo/.pstdio/workspaces/PS-307_A1",
          workspaceShorthand: "PS-307_A1",
        },
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

  test("uses the first linked repository path for a default workspace resource", () => {
    const [workspace] = buildDashboardWorkspacesFromRows(
      {
        ...rows,
        workspaces: [{ ...rows.workspaces[0], branch: "main", worktree_path: null }],
      },
      { projectId: "project-1" },
    );

    expect(workspace.resource.metadata).toMatchObject({ workspacePath: "/repo/prompt-studio" });
  });

  test("shows provider failures without assigning the project repository path", () => {
    const [workspace] = buildDashboardWorkspacesFromRows(
      {
        ...rows,
        workspaces: [
          {
            ...rows.workspaces[0],
            worktree_path: null,
            execution_kind: "remote",
            provider_id: "example.remote-execution.workspace-type.remote",
            provider_state: "failed",
            display_path: "remote://runner-42/workspace",
            provider_error_json: { message: "remote create failed" },
          },
        ],
      },
      { projectId: "project-1" },
    );

    expect(workspace.setupError).toBe("remote create failed");
    expect(workspace.resource.metadata).toMatchObject({
      workspaceExecutionKind: "remote",
      workspaceProviderState: "failed",
      workspaceError: "remote create failed",
    });
    expect(workspace.resource.metadata).not.toHaveProperty("workspacePath");
    expect(toWorkspaceDataTableRow(workspace).values).toMatchObject({
      provider: "example.remote-execution.workspace-type.remote",
      state: "Failed",
      location: "remote://runner-42/workspace",
      error: "remote create failed",
    });
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
      resourceParent: {
        type: "ticket",
        id: "ticket-1",
        label: "PS-307",
        metadata: { shorthand: "PS-307" },
      },
    });
  });

  test("carries planner ticket parent edges into workspace resource metadata", () => {
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
                  resourceParent: {
                    type: "ticket",
                    id: "ticket-parent",
                    label: "PS-307 Parent",
                    metadata: { shorthand: "PS-307" },
                  },
                },
              },
            ],
          },
        ],
      },
      { projectId: "project-1" },
    );

    expect(workspace.resource.metadata).toMatchObject({
      resourceParent: {
        type: "ticket",
        id: "ticket-child",
        label: "PS-308",
        metadata: {
          shorthand: "PS-308",
          resourceParent: {
            type: "ticket",
            id: "ticket-parent",
            label: "PS-307 Parent",
            metadata: { shorthand: "PS-307" },
          },
        },
      },
    });
  });

  test("maps a workspace into a data table row with diff values", () => {
    const [workspace] = buildDashboardWorkspacesFromRows(rows, {
      projectId: "project-1",
      diffSummariesByWorkspaceId: new Map([
        ["workspace-1", { workspaceId: "workspace-1", additions: 0, deletions: 0, fileCount: 0 }],
      ]),
    });

    expect(toWorkspaceDataTableRow(workspace)).toMatchObject({
      id: "dashboard-workbench://workspace/workspace-1",
      values: {
        attempt: "PS-307_A1",
        name: "Dashboard workbench datalayer",
        type: "Worktree",
        provider: "pstdio.root",
        state: "Ready",
        diff: "+0 -0",
      },
    });
  });

  test("omits the diff value when no summary is available", () => {
    const [workspace] = buildDashboardWorkspacesFromRows(rows, { projectId: "project-1" });

    expect(toWorkspaceDataTableRow(workspace).values).not.toHaveProperty("diff");
  });

  test("includes archived workspaces only when the collection asks for them", () => {
    const archivedWorkspace = { ...rows.workspaces[0], id: "workspace-archived", archived: true };
    const rowsWithArchive = { ...rows, workspaces: [...rows.workspaces, archivedWorkspace] };

    expect(buildDashboardWorkspacesFromRows(rowsWithArchive, { projectId: "project-1" })).toHaveLength(1);

    const workspaces = buildDashboardWorkspacesFromRows(rowsWithArchive, {
      projectId: "project-1",
      includeArchived: true,
    });

    expect(workspaces.map((workspace) => workspace.id)).toEqual(["workspace-1", "workspace-archived"]);
    expect(toWorkspaceDataTableRow(workspaces[1]!).values.state).toBe("Archived");
  });
});
