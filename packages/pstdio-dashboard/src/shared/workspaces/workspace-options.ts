import { createDashboardResource } from "@/shared/app/resources";
import { indexFirstProjectRepoPaths } from "@/shared/projects/project-repo-path";
import {
  type DashboardRows,
  isDashboardProjectRow,
  isVisibleDashboardRow,
  readDashboardRows,
} from "@/shared/sync/dashboard-rows";

export interface DashboardWorkspaceOption {
  id: string;
  title: string;
  shorthand: string;
  branch: string | null;
  type: "worktree" | "current_branch";
  isDefault: boolean;
  workspacePath: string | null;
  updatedAt: string;
}

const toWorkspaceOption = (
  workspace: DashboardRows["workspaces"][number],
  repoPathByProjectId: ReadonlyMap<string, string>,
): DashboardWorkspaceOption => ({
  id: workspace.id,
  title: (workspace.name as string | null) ?? (workspace.workspace_shorthand as string),
  shorthand: workspace.workspace_shorthand as string,
  branch: (workspace.branch as string | null) ?? null,
  type: workspace.worktree_path ? "worktree" : "current_branch",
  isDefault: Boolean(workspace.is_default),
  workspacePath:
    (workspace.worktree_path as string | null) ?? repoPathByProjectId.get(workspace.project_id as string) ?? null,
  updatedAt: (workspace.updated_at as string) ?? (workspace.created_at as string) ?? "",
});

export const createDashboardWorkspaceOptionResource = (workspace: DashboardWorkspaceOption, projectId?: string) =>
  createDashboardResource("workspace", workspace.id, workspace.title, "GitBranch", projectId, {
    workspaceId: workspace.id,
    workspaceShorthand: workspace.shorthand,
    workspaceType: workspace.type,
    workspaceIsDefault: workspace.isDefault,
    ...(workspace.workspacePath ? { workspacePath: workspace.workspacePath } : {}),
    ...(workspace.branch ? { workspaceBranch: workspace.branch } : {}),
  });

// The default workspace (root repo) is pinned first; the rest follow newest-first.
export const buildDashboardWorkspaceOptionsFromRows = (rows: DashboardRows, projectId?: string) => {
  const repoPathByProjectId = indexFirstProjectRepoPaths(rows.projectRepos, rows.repos);

  return rows.workspaces
    .filter((workspace) => isVisibleDashboardRow(workspace) && isDashboardProjectRow(workspace, projectId))
    .map((workspace) => toWorkspaceOption(workspace, repoPathByProjectId))
    .sort((a, b) => {
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
      return b.updatedAt.localeCompare(a.updatedAt);
    });
};

export const createDashboardWorkspaceOptions = (projectId?: string) =>
  buildDashboardWorkspaceOptionsFromRows(readDashboardRows(), projectId);
