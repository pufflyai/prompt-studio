import type { DataTableRendererRow, ResourceRef } from "@pstdio/workbench";
import type { SyncedRow } from "@/lib/sync/collections";
import { createDashboardResource } from "@/shared/app/resources";
import { indexFirstProjectRepoPaths } from "@/shared/projects/project-repo-path";
import {
  type DashboardRows,
  isDashboardProjectRow,
  isVisibleDashboardRow,
  readDashboardRows,
} from "@/shared/sync/dashboard-rows";
import { listResourceAnchors } from "@/shared/sync/resource-anchors";
import {
  type DashboardWorkspaceDiffSummary,
  formatDashboardWorkspaceDiffOverview,
  getDashboardWorkspaceDiffSummaries,
} from "@/shared/workspaces/workspace-diff-summary-data";
import { createDashboardWorkspaceCapabilityMetadata } from "@/shared/workspaces/workspace-options";

export interface DashboardWorkspace {
  id: string;
  title: string;
  shorthand: string;
  type: "worktree" | "current_branch";
  additions: number;
  deletions: number;
  diffOverview?: string;
  diffFileCount?: number;
  createdAt: string;
  updatedAt: string;
  branch: string | null;
  worktreePath: string | null;
  isDefault: boolean;
  archived: boolean;
  setupError: string | null;
  displayPath: string | null;
  provider: string;
  providerState: string;
  resource: ResourceRef;
}

export interface DashboardWorkspaceRow extends DataTableRendererRow {
  resource: ResourceRef;
}

interface DashboardWorkspaceOptions {
  projectId?: string;
  includeArchived?: boolean;
  diffSummariesByWorkspaceId?: Map<string, DashboardWorkspaceDiffSummary>;
}

const anchorMetadataFromWorkspace = (workspace: SyncedRow) => {
  const anchor = listResourceAnchors(workspace)[0];
  if (!anchor) return {};

  return {
    resourceParent: {
      type: anchor.type,
      id: anchor.id,
      ...(anchor.label ? { label: anchor.label } : {}),
      ...(anchor.metadata ? { metadata: anchor.metadata } : {}),
    },
  };
};

const createWorkspaceResourceMetadata = (input: {
  workspace: SyncedRow;
  workspacePath: string | null;
  summary?: DashboardWorkspaceDiffSummary;
}) => {
  const branch = input.workspace.branch as string | null;
  const executionKind = input.workspace.execution_kind === "remote" ? "remote" : "local";
  const providerState = (input.workspace.provider_state as string | undefined) ?? "ready";
  const providerError = input.workspace.provider_error_json as { message?: string } | null | undefined;
  const providerCapabilities = input.workspace.provider_capabilities_json as
    | { archive?: boolean; delete?: boolean; diff?: boolean; files?: "none" | "read" | "write" }
    | undefined;
  const metadata: Record<string, unknown> = {
    workspaceId: input.workspace.id,
    ...(input.workspacePath ? { workspacePath: input.workspacePath } : {}),
    workspaceShorthand: input.workspace.workspace_shorthand as string,
    workspaceType: input.workspace.worktree_path ? "worktree" : "current_branch",
    ...createDashboardWorkspaceCapabilityMetadata({
      executionKind,
      providerState,
      supportsArchive: providerCapabilities?.archive === true,
      supportsDelete: providerCapabilities?.delete === true,
      supportsFiles: providerCapabilities ? providerCapabilities.files !== "none" : executionKind === "local",
      supportsDiff: providerCapabilities ? providerCapabilities.diff === true : executionKind === "local",
    }),
    ...(input.workspace.provider_id ? { workspaceProviderId: input.workspace.provider_id } : {}),
    ...(input.workspace.display_path ? { workspaceDisplayPath: input.workspace.display_path } : {}),
    ...(providerError?.message ? { workspaceError: providerError.message } : {}),
    // Resource-scoped action menus (header overflow, tree context menu) gate the
    // rename/archive/delete actions on this flag so the default workspace stays permanent.
    workspaceIsDefault: Boolean(input.workspace.is_default),
    ...anchorMetadataFromWorkspace(input.workspace),
    // Sessions created from a workspace inherit this so the composer stays locked to the workspace branch.
    ...(branch ? { workspaceBranch: branch } : {}),
  };

  if (input.summary) {
    metadata.diffOverview = formatDashboardWorkspaceDiffOverview(input.summary);
    metadata.diffAdditions = input.summary.additions;
    metadata.diffDeletions = input.summary.deletions;
    metadata.diffFileCount = input.summary.fileCount;
  }

  return metadata;
};

export const buildDashboardWorkspacesFromRows = (rows: DashboardRows, options: DashboardWorkspaceOptions = {}) => {
  const repoPathByProjectId = indexFirstProjectRepoPaths(rows.projectRepos, rows.repos);

  return rows.workspaces
    .filter(
      (workspace) =>
        (options.includeArchived ? !workspace.deleted_at : isVisibleDashboardRow(workspace)) &&
        isDashboardProjectRow(workspace, options.projectId),
    )
    .map((workspace) => {
      const title = (workspace.name as string | null) ?? (workspace.workspace_shorthand as string);
      const type: DashboardWorkspace["type"] = workspace.worktree_path ? "worktree" : "current_branch";
      const summary = options.diffSummariesByWorkspaceId?.get(workspace.id);
      const diffOverview = summary ? formatDashboardWorkspaceDiffOverview(summary) : undefined;
      const workspacePath =
        workspace.execution_kind === "remote"
          ? null
          : ((workspace.worktree_path as string | null) ??
            repoPathByProjectId.get(workspace.project_id as string) ??
            null);
      const providerError = workspace.provider_error_json as { message?: string } | null | undefined;

      return {
        id: workspace.id,
        title,
        shorthand: workspace.workspace_shorthand as string,
        type,
        additions: summary?.additions ?? 0,
        deletions: summary?.deletions ?? 0,
        diffOverview,
        diffFileCount: summary?.fileCount,
        createdAt: (workspace.created_at as string) ?? "",
        updatedAt: (workspace.updated_at as string) ?? "",
        branch: (workspace.branch as string | null) ?? null,
        worktreePath: (workspace.worktree_path as string | null) ?? null,
        isDefault: Boolean(workspace.is_default),
        archived: Boolean(workspace.archived),
        setupError: (workspace.setup_error as string | null) ?? providerError?.message ?? null,
        displayPath: (workspace.display_path as string | null) ?? null,
        provider: (workspace.provider_id as string | undefined) ?? "pstdio.root",
        providerState: (workspace.provider_state as string | undefined) ?? "ready",
        resource: createDashboardResource(
          "workspace",
          workspace.id,
          title,
          "GitBranch",
          workspace.project_id as string,
          createWorkspaceResourceMetadata({ workspace, workspacePath, summary }),
        ),
      } satisfies DashboardWorkspace;
    })
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
};

export const createDashboardWorkspaces = (projectId?: string, options: { includeArchived?: boolean } = {}) => {
  const rows = readDashboardRows();
  return buildDashboardWorkspacesFromRows(rows, {
    projectId,
    includeArchived: options.includeArchived,
    diffSummariesByWorkspaceId: getDashboardWorkspaceDiffSummaries(
      rows.workspaces.filter((workspace) => !workspace.archived).map((workspace) => workspace.id),
    ),
  });
};

const formatWorkspaceState = (workspace: DashboardWorkspace) => {
  const state = workspace.archived ? "archived" : workspace.providerState;
  const label = state.replaceAll("_", " ");
  return `${label.charAt(0).toUpperCase()}${label.slice(1)}`;
};

export const toWorkspaceDataTableRow = (workspace: DashboardWorkspace): DashboardWorkspaceRow => ({
  id: workspace.resource.uri,
  resource: workspace.resource,
  values: {
    attempt: workspace.shorthand,
    name: workspace.title,
    type: workspace.type === "worktree" ? "Worktree" : "Current branch",
    provider: workspace.provider,
    state: formatWorkspaceState(workspace),
    branch: workspace.branch ?? "",
    created: workspace.createdAt,
    updated: workspace.updatedAt,
    ...(workspace.setupError ? { error: workspace.setupError } : {}),
    ...(workspace.displayPath ? { location: workspace.displayPath } : {}),
    ...(workspace.diffOverview !== undefined ? { diff: workspace.diffOverview } : {}),
  },
});
