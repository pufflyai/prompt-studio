import { describe, expect, test } from "bun:test";
import type { DashboardRows } from "@/shared/sync/dashboard-rows";
import { buildDashboardWorkspaceOptionsFromRows, createDashboardWorkspaceOptionResource } from "./workspace-options";

const rows: DashboardRows = {
  files: [],
  projectRepos: [{ id: "project-repo-1", project_id: "project-1", repo_id: "repo-1" }],
  repos: [{ id: "repo-1", path: "/repo/prompt-studio" }],
  sessions: [],
  workspaceSessions: [],
  workspaces: [
    {
      id: "workspace-default",
      project_id: "project-1",
      name: "Root repo",
      branch: "main",
      worktree_path: null,
      workspace_shorthand: "ROOT",
      is_default: true,
      created_at: "2026-06-01T10:00:00Z",
      updated_at: "2026-06-01T10:00:00Z",
    },
    {
      id: "workspace-worktree",
      project_id: "project-1",
      name: "Feature branch",
      branch: "workspace/PS-43_A1",
      worktree_path: "/repo/.pstdio/workspaces/PS-43_A1",
      workspace_shorthand: "PS-43_A1",
      is_default: false,
      created_at: "2026-06-02T10:00:00Z",
      updated_at: "2026-06-02T10:00:00Z",
    },
  ],
};

describe("dashboard workspace options", () => {
  test("carries effective paths into resources for default and worktree workspaces", () => {
    const options = buildDashboardWorkspaceOptionsFromRows(rows, "project-1");
    const resources = options.map((workspace) => createDashboardWorkspaceOptionResource(workspace, "project-1"));

    expect(resources).toEqual([
      expect.objectContaining({ metadata: expect.objectContaining({ workspacePath: "/repo/prompt-studio" }) }),
      expect.objectContaining({
        metadata: expect.objectContaining({ workspacePath: "/repo/.pstdio/workspaces/PS-43_A1" }),
      }),
    ]);
  });
});
