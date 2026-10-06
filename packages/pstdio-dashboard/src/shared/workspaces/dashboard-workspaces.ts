import { resourceKey } from "@pstdio/sdk/extensions";
import type { DataTableRendererRow, ResourceRef } from "@pstdio/workbench";
import { getCollection, type SyncedRow } from "@/lib/sync/collections";
import { createDashboardResource, dashboardViews } from "@/shared/app/resources";
import {
  type DashboardRows,
  isDashboardProjectRow,
  isVisibleDashboardRow,
  readWorkspaceRows,
} from "@/shared/sync/dashboard-rows";
import { listResourceAnchors } from "@/shared/sync/resource-anchors";
import {
  type DashboardWorkspaceDiffSummary,
  formatDashboardWorkspaceDiffOverview,
  getDashboardWorkspaceDiffSummaries,
} from "@/shared/workspaces/workspace-diff-summary-data";
import { createDashboardWorkspaceCapabilityMetadata } from "@/shared/workspaces/workspace-options";
import { workspaceIcon, workspaceKind } from "./workspace-kind";
import { workspaceState } from "./workspace-state";
export interface DashboardWorkspace {
  id: string;
  title: string;
  shorthand: string;
  type: "worktree" | "folder" | "remote";
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
  supportsDiff: boolean;
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
  const providerState = workspaceState(input.workspace);
  const providerError = input.workspace.provider_error_json as
    | {
        message?: string;
      }
    | null
    | undefined;
  const providerCapabilities = input.workspace.provider_capabilities_json as
    | {
        archive?: boolean;
        delete?: boolean;
        diff?: boolean;
        files?: "none" | "read" | "write";
      }
    | undefined;
  const metadata: Record<string, unknown> = {
    workspaceId: input.workspace.id,
    ...(input.workspacePath ? { workspacePath: input.workspacePath } : {}),
    workspaceShorthand: input.workspace.workspace_shorthand as string,
    workspaceType: workspaceKind(input.workspace),
    ...createDashboardWorkspaceCapabilityMetadata({
      executionKind,
      providerState,
      supportsArchive: providerCapabilities?.archive === true,
      supportsDelete: providerCapabilities?.delete === true,
      supportsFiles: providerCapabilities ? providerCapabilities.files !== "none" : executionKind === "local",
      supportsDiff: providerCapabilities?.diff === true,
    }),
    ...(input.workspace.provider_id ? { workspaceProviderId: input.workspace.provider_id } : {}),
    ...(input.workspace.display_path ? { workspaceDisplayPath: input.workspace.display_path } : {}),
    workspaceError: input.workspace.setup_error ?? providerError?.message ?? null,
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
export const buildDashboardWorkspacesFromRows = (
  rows: Pick<DashboardRows, "workspaces">,
  options: DashboardWorkspaceOptions = {},
) => {
  return rows.workspaces
    .filter(
      (workspace) =>
        (options.includeArchived ? !workspace.deleted_at : isVisibleDashboardRow(workspace)) &&
        isDashboardProjectRow(workspace, options.projectId),
    )
    .map((workspace) => {
      const title = (workspace.name as string | null) ?? (workspace.workspace_shorthand as string);
      const type: DashboardWorkspace["type"] = workspaceKind(workspace);
      const summary = options.diffSummariesByWorkspaceId?.get(workspace.id);
      const diffOverview = summary ? formatDashboardWorkspaceDiffOverview(summary) : undefined;
      const workspacePath =
        workspace.execution_kind === "remote" ? null : ((workspace.root_path as string | null) ?? null);
      const providerError = workspace.provider_error_json as
        | {
            message?: string;
          }
        | null
        | undefined;
      const metadata = createWorkspaceResourceMetadata({ workspace, workspacePath, summary });
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
        worktreePath: (workspace.root_path as string | null) ?? null,
        isDefault: Boolean(workspace.is_default),
        archived: Boolean(workspace.archived),
        setupError: (workspace.setup_error as string | null) ?? providerError?.message ?? null,
        displayPath: (workspace.display_path as string | null) ?? workspacePath,
        supportsDiff: metadata.workspaceSupportsDiff === true,
        provider: (workspace.provider_id as string | undefined) ?? "pstdio.root",
        providerState: workspaceState(workspace),
        resource: createDashboardResource(
          "workspace",
          workspace.id,
          title,
          workspaceIcon(type),
          workspace.project_id as string,
          metadata,
        ),
      } satisfies DashboardWorkspace;
    })
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
};
// The version argument makes the React compiler read the synced rows again after each sync change.
export const readProjectSetupError = (projectId: string | undefined, _dataVersion: number) => {
  if (!projectId) return null;
  return (
    buildDashboardWorkspacesFromRows(readWorkspaceRows(), { projectId }).find((workspace) => workspace.isDefault)
      ?.setupError ?? null
  );
};
// Tools can link a workspace by id alone. Its icon still comes from the synced row, so every route shows the same icon.
export const resolveDashboardWorkspaceIcon = (workspaceId: string) => {
  const workspace = getCollection("workspaces").state.get(workspaceId);
  return workspace ? workspaceIcon(workspaceKind(workspace)) : dashboardViews.workspaces.icon;
};

export const createDashboardWorkspaces = (
  projectId?: string,
  options: {
    includeArchived?: boolean;
  } = {},
) => {
  const rows = readWorkspaceRows();
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
const workspaceTypeLabels = { worktree: "Git worktree", folder: "Project folder", remote: "Remote workspace" };

// A workspace without the diff capability says so; a supported diff that is still loading has no value yet.
const workspaceDiffValue = (workspace: DashboardWorkspace) => {
  if (!workspace.supportsDiff) return "Not supported";
  if (workspace.diffOverview === undefined) return undefined;
  return { additions: workspace.additions, deletions: workspace.deletions };
};

export const toWorkspaceDataTableRow = (workspace: DashboardWorkspace): DashboardWorkspaceRow => {
  const diff = workspaceDiffValue(workspace);
  return {
    id: resourceKey(workspace.resource),
    resource: workspace.resource,
    values: {
      name: workspace.title,
      type: workspaceTypeLabels[workspace.type],
      ...(workspace.displayPath ? { location: workspace.displayPath } : {}),
      created: workspace.createdAt,
      ...(diff !== undefined ? { diff } : {}),
      attempt: workspace.shorthand,
      provider: workspace.provider,
      state: formatWorkspaceState(workspace),
      branch: workspace.branch ?? "",
      updated: workspace.updatedAt,
      ...(workspace.setupError ? { error: workspace.setupError } : {}),
    },
  };
};
