import { describe, expect, test } from "bun:test";
import { resourceKey } from "@pstdio/sdk/extensions";
import { getWriter } from "@/lib/sync/collections";
import {
  buildDashboardWorkspacesFromRows,
  readProjectSetupError,
  toWorkspaceDataTableRow,
} from "./dashboard-workspaces";

const rows = {
  files: [],
  sessions: [],
  workspaceSessions: [],
  workspaces: [
    {
      id: "workspace-1",
      provider_id: "pstdio.worktree",
      project_id: "project-1",
      name: "Dashboard workbench datalayer",
      branch: "workspace/PS-307_A1",
      root_path: "/repo/.pstdio/workspaces/PS-307_A1",
      provider_capabilities_json: { diff: true, files: "write" },
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
      root_path: null,
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
        type: "workspace",
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

  test("uses the selected folder for a default workspace resource", () => {
    const [workspace] = buildDashboardWorkspacesFromRows(
      {
        ...rows,
        workspaces: [
          {
            ...rows.workspaces[0],
            is_default: true,
            provider_id: "pstdio.root",
            branch: null,
            root_path: "/repo/prompt-studio",
          },
        ],
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
            root_path: null,
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
});

describe("dashboard workspace list rows", () => {
  test("maps a workspace into a data table row with diff values", () => {
    const [workspace] = buildDashboardWorkspacesFromRows(rows, {
      projectId: "project-1",
      diffSummariesByWorkspaceId: new Map([
        ["workspace-1", { workspaceId: "workspace-1", additions: 0, deletions: 0, fileCount: 0 }],
      ]),
    });

    expect(toWorkspaceDataTableRow(workspace)).toMatchObject({
      id: resourceKey({ type: "workspace", id: "workspace-1" }),
      values: {
        attempt: "PS-307_A1",
        name: "Dashboard workbench datalayer",
        type: "Git worktree",
        provider: "pstdio.worktree",
        state: "Ready",
        created: "2026-05-22T08:10:00Z",
        diff: { additions: 0, deletions: 0 },
      },
    });
  });

  test("omits the diff value while a supported diff is not loaded", () => {
    const [workspace] = buildDashboardWorkspacesFromRows(rows, { projectId: "project-1" });

    expect(toWorkspaceDataTableRow(workspace).values).not.toHaveProperty("diff");
  });

  test("marks the diff as not supported when the provider has no diff capability", () => {
    const [workspace] = buildDashboardWorkspacesFromRows(
      {
        ...rows,
        workspaces: [
          {
            ...rows.workspaces[0],
            provider_id: "pstdio.root",
            provider_capabilities_json: { diff: false, files: "write" },
          },
        ],
      },
      { projectId: "project-1" },
    );

    expect(toWorkspaceDataTableRow(workspace).values.diff).toBe("Not supported");
  });

  test("shows a local workspace folder as its location when the provider supplies none", () => {
    const [local, remote] = buildDashboardWorkspacesFromRows(
      {
        ...rows,
        workspaces: [
          { ...rows.workspaces[0], display_path: null },
          {
            ...rows.workspaces[0],
            id: "workspace-remote",
            created_at: "2026-05-23T08:10:00Z",
            execution_kind: "remote",
            display_path: null,
          },
        ],
      },
      { projectId: "project-1" },
    );

    expect(toWorkspaceDataTableRow(local!).values.location).toBe("/repo/.pstdio/workspaces/PS-307_A1");
    expect(toWorkspaceDataTableRow(remote!).values).not.toHaveProperty("location");
  });

  test("gives each workspace kind its own resource icon", () => {
    const workspaces = buildDashboardWorkspacesFromRows(
      {
        ...rows,
        workspaces: [
          { ...rows.workspaces[0], id: "worktree", created_at: "2026-05-21T08:10:00Z" },
          { ...rows.workspaces[0], id: "folder", provider_id: "pstdio.root", created_at: "2026-05-22T08:10:00Z" },
          { ...rows.workspaces[0], id: "remote", execution_kind: "remote", created_at: "2026-05-23T08:10:00Z" },
        ],
      },
      { projectId: "project-1" },
    );

    expect(workspaces.map((workspace) => workspace.resource.icon)).toEqual(["GitBranch", "Folder", "Cloud"]);
  });

  test("reads the setup error of the selected project's default workspace only", () => {
    getWriter("workspaces")?.truncateAndWrite([
      { ...rows.workspaces[1], is_default: true, setup_error: "spawn git ENOENT" },
      { ...rows.workspaces[0], is_default: true, setup_error: null },
    ]);

    expect(readProjectSetupError("project-2", 0)).toBe("spawn git ENOENT");
    expect(readProjectSetupError("project-1", 0)).toBeNull();
    expect(readProjectSetupError(undefined, 0)).toBeNull();
  });
});
