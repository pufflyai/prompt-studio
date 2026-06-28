import type { DataRendererRow } from "@pstdio/ui";
import type { ResourceRef } from "pstdio-workbench/core";
import type { SyncedRow } from "@/lib/sync/collections";
import { createDashboardResource } from "@/shared/app/resources";
import {
  type DashboardRows,
  isDashboardProjectRow,
  isVisibleDashboardRow,
  readDashboardRows,
} from "@/shared/sync/dashboard-rows";
import {
  type DashboardWorkspaceDiffSummary,
  formatDashboardWorkspaceDiffOverview,
  getDashboardWorkspaceDiffSummaries,
} from "@/shared/workspaces/workspace-diff-summary-data";

export interface DashboardWorkspaceAttributes {
  id: string;
  type: "worktree" | "current_branch";
  isDefault: boolean;
  created: string;
  updated: string;
  diffOverview?: string;
  diffAdditions?: number;
  diffDeletions?: number;
  diffFileCount?: number;
  [key: string]: unknown;
}

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
  setupError: string | null;
  resource: ResourceRef;
}

export interface DashboardWorkspaceRow extends DataRendererRow {
  resource: ResourceRef;
  attributes: DashboardWorkspaceAttributes;
}

interface DashboardWorkspaceOptions {
  projectId?: string;
  diffSummariesByWorkspaceId?: Map<string, DashboardWorkspaceDiffSummary>;
}

type WorkspaceResourceAnchor = {
  type: string;
  id: string;
  label?: string;
  metadata?: Record<string, unknown>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isWorkspaceResourceAnchor = (value: unknown): value is WorkspaceResourceAnchor =>
  isRecord(value) && typeof value.type === "string" && typeof value.id === "string";

const ticketAnchorFromWorkspace = (workspace: SyncedRow) => {
  const anchors = workspace.anchors_json;
  if (!Array.isArray(anchors)) return undefined;

  return anchors.find((anchor) => isWorkspaceResourceAnchor(anchor) && anchor.type === "ticket");
};

const ticketShorthandFromAnchor = (anchor: WorkspaceResourceAnchor) => {
  const shorthand = anchor.metadata?.shorthand;
  return typeof shorthand === "string" ? shorthand : anchor.label;
};

const textValue = (value: unknown) => (typeof value === "string" && value.length > 0 ? value : undefined);

const ticketBreadcrumbFromAnchor = (anchor: WorkspaceResourceAnchor) => {
  const breadcrumb = anchor.metadata?.ticketBreadcrumb;
  if (!Array.isArray(breadcrumb)) return undefined;

  const items = breadcrumb.flatMap((item) => {
    if (!isRecord(item)) return [];
    const id = textValue(item.id);
    if (!id) return [];
    const shorthand = textValue(item.shorthand);
    const label = textValue(item.label) ?? shorthand ?? id;
    return [{ id, label, ...(shorthand ? { shorthand } : {}) }];
  });

  return items.length > 0 ? items : undefined;
};

const ticketMetadataFromWorkspace = (workspace: SyncedRow) => {
  const anchor = ticketAnchorFromWorkspace(workspace);
  if (!anchor) return {};

  const ticketShorthand = ticketShorthandFromAnchor(anchor);
  const ticketLabel = anchor.label ?? ticketShorthand;
  const ticketBreadcrumb = ticketBreadcrumbFromAnchor(anchor);

  return {
    ticketId: anchor.id,
    ...(ticketShorthand ? { ticketShorthand } : {}),
    ...(ticketLabel ? { ticketLabel } : {}),
    ...(ticketBreadcrumb ? { ticketBreadcrumb } : {}),
  };
};

const createWorkspaceResourceMetadata = (input: { workspace: SyncedRow; summary?: DashboardWorkspaceDiffSummary }) => {
  const branch = input.workspace.branch as string | null;
  const metadata: Record<string, unknown> = {
    workspaceId: input.workspace.id,
    workspaceShorthand: input.workspace.workspace_shorthand as string,
    workspaceType: input.workspace.worktree_path ? "worktree" : "current_branch",
    // Resource-scoped action menus (header overflow, tree context menu) gate the
    // rename/archive/delete actions on this flag so the default workspace stays permanent.
    workspaceIsDefault: Boolean(input.workspace.is_default),
    ...ticketMetadataFromWorkspace(input.workspace),
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

export const buildDashboardWorkspacesFromRows = (rows: DashboardRows, options: DashboardWorkspaceOptions = {}) =>
  rows.workspaces
    .filter((workspace) => isVisibleDashboardRow(workspace) && isDashboardProjectRow(workspace, options.projectId))
    .map((workspace) => {
      const title = (workspace.name as string | null) ?? (workspace.workspace_shorthand as string);
      const type: DashboardWorkspace["type"] = workspace.worktree_path ? "worktree" : "current_branch";
      const summary = options.diffSummariesByWorkspaceId?.get(workspace.id);
      const diffOverview = summary ? formatDashboardWorkspaceDiffOverview(summary) : undefined;

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
        setupError: (workspace.setup_error as string | null) ?? null,
        resource: createDashboardResource(
          "workspace",
          workspace.id,
          title,
          "GitBranch",
          workspace.project_id as string,
          createWorkspaceResourceMetadata({ workspace, summary }),
        ),
      } satisfies DashboardWorkspace;
    })
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

export const createDashboardWorkspaces = (projectId?: string) => {
  const rows = readDashboardRows();
  return buildDashboardWorkspacesFromRows(rows, {
    projectId,
    diffSummariesByWorkspaceId: getDashboardWorkspaceDiffSummaries(rows.workspaces.map((workspace) => workspace.id)),
  });
};

export const toWorkspaceRow = (workspace: DashboardWorkspace): DashboardWorkspaceRow => ({
  id: workspace.resource.uri,
  title: workspace.title,
  resource: workspace.resource,
  attributes: {
    id: workspace.shorthand,
    type: workspace.type,
    isDefault: workspace.isDefault,
    created: workspace.createdAt,
    updated: workspace.updatedAt,
    ...(workspace.diffOverview !== undefined
      ? {
          diffOverview: workspace.diffOverview,
          diffAdditions: workspace.additions,
          diffDeletions: workspace.deletions,
          diffFileCount: workspace.diffFileCount,
        }
      : {}),
  },
});

export const createWorkspaceRows = (projectId?: string) => createDashboardWorkspaces(projectId).map(toWorkspaceRow);
