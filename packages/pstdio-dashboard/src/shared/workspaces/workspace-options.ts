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
  executionKind: "local" | "remote";
  providerState: string;
  supportsFiles: boolean;
  supportsDiff: boolean;
  supportsArchive: boolean;
  supportsDelete: boolean;
  workspacePath: string | null;
  updatedAt: string;
}

type DashboardWorkspaceCapabilities = Pick<
  DashboardWorkspaceOption,
  "executionKind" | "providerState" | "supportsArchive" | "supportsDelete" | "supportsDiff" | "supportsFiles"
>;

export const createDashboardWorkspaceCapabilityMetadata = (workspace: DashboardWorkspaceCapabilities) => ({
  workspaceExecutionKind: workspace.executionKind,
  workspaceProviderState: workspace.providerState,
  workspaceSupportsArchive: workspace.supportsArchive,
  workspaceSupportsDelete: workspace.supportsDelete,
  workspaceSupportsFiles: workspace.supportsFiles,
  workspaceSupportsDiff: workspace.supportsDiff,
});

const toWorkspaceOption = (
  workspace: DashboardRows["workspaces"][number],
  repoPathByProjectId: ReadonlyMap<string, string>,
): DashboardWorkspaceOption => {
  const executionKind = workspace.execution_kind === "remote" ? "remote" : "local";
  const capabilities = workspace.provider_capabilities_json as
    | { archive?: boolean; delete?: boolean; files?: string; diff?: boolean }
    | undefined;
  const workspacePath =
    executionKind === "remote"
      ? null
      : ((workspace.worktree_path as string | null) ?? repoPathByProjectId.get(workspace.project_id as string) ?? null);

  return {
    id: workspace.id,
    title: (workspace.name as string | null) ?? (workspace.workspace_shorthand as string),
    shorthand: workspace.workspace_shorthand as string,
    branch: (workspace.branch as string | null) ?? null,
    type: workspace.worktree_path ? "worktree" : "current_branch",
    isDefault: Boolean(workspace.is_default),
    executionKind,
    providerState: (workspace.provider_state as string | undefined) ?? "ready",
    supportsFiles: capabilities ? capabilities.files !== "none" : executionKind === "local",
    supportsDiff: capabilities ? capabilities.diff === true : executionKind === "local",
    supportsArchive: capabilities?.archive === true,
    supportsDelete: capabilities?.delete === true,
    workspacePath,
    updatedAt: (workspace.updated_at as string) ?? (workspace.created_at as string) ?? "",
  };
};

export const createDashboardWorkspaceOptionResource = (workspace: DashboardWorkspaceOption, projectId?: string) =>
  createDashboardResource("workspace", workspace.id, workspace.title, "GitBranch", projectId, {
    workspaceId: workspace.id,
    workspaceShorthand: workspace.shorthand,
    workspaceType: workspace.type,
    workspaceIsDefault: workspace.isDefault,
    ...createDashboardWorkspaceCapabilityMetadata(workspace),
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
