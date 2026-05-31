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
import { createEmptyDashboardWorkspaceReview, type DashboardWorkspaceReview } from "./workspace-review-data";

export interface DashboardWorkspaceAttributes {
  id: string;
  type: "worktree" | "current_branch";
  updated: string;
  diffOverview?: string;
  diffAdditions?: number;
  diffDeletions?: number;
  diffFileCount?: number;
  [key: string]: unknown;
}

export interface DashboardWorkspaceSession {
  id: string;
  title: string;
  status: string;
  agent: string | null;
  lastSelectedModel: string | null;
  updatedAt: string;
  workspaceId: string | null;
  workspaceBranch: string | null;
  workspaceShorthand: string;
  resource: ResourceRef;
}

export interface DashboardWorkspace {
  id: string;
  title: string;
  shorthand: string;
  type: "worktree" | "current_branch";
  sessionStatus: string;
  additions: number;
  deletions: number;
  diffOverview?: string;
  diffFileCount?: number;
  updatedAt: string;
  branch: string | null;
  worktreePath: string | null;
  setupError: string | null;
  resource: ResourceRef;
  sessions: DashboardWorkspaceSession[];
  review: DashboardWorkspaceReview;
}

export interface DashboardWorkspaceRow extends DataRendererRow {
  resource: ResourceRef;
  attributes: DashboardWorkspaceAttributes;
}

interface DashboardWorkspaceOptions {
  projectId?: string;
  diffSummariesByWorkspaceId?: Map<string, DashboardWorkspaceDiffSummary>;
}

const createWorkspaceResourceMetadata = (input: { workspace: SyncedRow; summary?: DashboardWorkspaceDiffSummary }) => {
  const workspaceShorthand = input.workspace.workspace_shorthand as string;
  const metadata: Record<string, unknown> = {
    workspaceId: input.workspace.id,
    workspaceShorthand,
    workspaceType: input.workspace.worktree_path ? "worktree" : "current_branch",
  };

  if (input.summary) {
    metadata.diffOverview = formatDashboardWorkspaceDiffOverview(input.summary);
    metadata.diffAdditions = input.summary.additions;
    metadata.diffDeletions = input.summary.deletions;
    metadata.diffFileCount = input.summary.fileCount;
  }

  return metadata;
};

const createWorkspaceSession = (session: SyncedRow, workspace: SyncedRow): DashboardWorkspaceSession => {
  const title = (session.title as string | null) ?? "Session";
  const projectId = (session.project_id as string | null | undefined) ?? (workspace.project_id as string | undefined);

  return {
    id: session.id,
    title,
    status: (session.status as string) ?? "unknown",
    agent: (session.agent as string | null) ?? null,
    lastSelectedModel: (session.last_selected_model as string | null) ?? null,
    updatedAt: (session.updated_at as string) ?? (session.created_at as string) ?? "",
    workspaceId: workspace.id,
    workspaceBranch: (workspace.branch as string | null) ?? null,
    workspaceShorthand: (workspace.workspace_shorthand as string | undefined) ?? "",
    resource: createDashboardResource("session", session.id, title, "MessageCircle", projectId),
  };
};

export const buildDashboardWorkspacesFromRows = (rows: DashboardRows, options: DashboardWorkspaceOptions = {}) => {
  const sessionById = new Map(
    rows.sessions
      .filter((session) => isVisibleDashboardRow(session) && isDashboardProjectRow(session, options.projectId))
      .map((session) => [session.id, session]),
  );
  const sessionLinksByWorkspaceId = new Map<string, SyncedRow[]>();

  for (const link of rows.workspaceSessions) {
    const workspaceId = link.workspace_id as string;
    const links = sessionLinksByWorkspaceId.get(workspaceId) ?? [];
    links.push(link);
    sessionLinksByWorkspaceId.set(workspaceId, links);
  }

  return rows.workspaces
    .filter((workspace) => isVisibleDashboardRow(workspace) && isDashboardProjectRow(workspace, options.projectId))
    .map((workspace) => {
      const title = (workspace.name as string | null) ?? (workspace.workspace_shorthand as string);
      const sessions = (sessionLinksByWorkspaceId.get(workspace.id) ?? [])
        .sort((a, b) => ((a.created_at as string) ?? "").localeCompare((b.created_at as string) ?? ""))
        .map((link) => sessionById.get(link.session_id as string))
        .filter((session): session is SyncedRow => Boolean(session))
        .map((session) => createWorkspaceSession(session, workspace));
      const [latestSession] = [...sessions].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      const type: DashboardWorkspace["type"] = workspace.worktree_path ? "worktree" : "current_branch";
      const review = createEmptyDashboardWorkspaceReview(workspace.id);
      const summary = options.diffSummariesByWorkspaceId?.get(workspace.id);
      const diffOverview = summary ? formatDashboardWorkspaceDiffOverview(summary) : undefined;

      return {
        id: workspace.id,
        title,
        shorthand: workspace.workspace_shorthand as string,
        type,
        sessionStatus: latestSession?.status ?? "unknown",
        additions: summary?.additions ?? 0,
        deletions: summary?.deletions ?? 0,
        diffOverview,
        diffFileCount: summary?.fileCount,
        updatedAt: (workspace.updated_at as string) ?? "",
        branch: (workspace.branch as string | null) ?? null,
        worktreePath: (workspace.worktree_path as string | null) ?? null,
        setupError: (workspace.setup_error as string | null) ?? null,
        resource: createDashboardResource(
          "workspace",
          workspace.id,
          title,
          "GitBranch",
          workspace.project_id as string,
          createWorkspaceResourceMetadata({ workspace, summary }),
        ),
        sessions,
        review,
      };
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
};

export const createDashboardWorkspaces = (projectId?: string) => {
  const rows = readDashboardRows();
  return buildDashboardWorkspacesFromRows(rows, {
    projectId,
    diffSummariesByWorkspaceId: getDashboardWorkspaceDiffSummaries(rows.workspaces.map((workspace) => workspace.id)),
  });
};

export const findDashboardWorkspace = (resource: ResourceRef, projectId?: string) =>
  createDashboardWorkspaces(projectId).find(
    (workspace) => workspace.resource.uri === resource.uri || workspace.id === resource.id,
  );

export const toWorkspaceRow = (workspace: DashboardWorkspace): DashboardWorkspaceRow => ({
  id: workspace.resource.uri,
  title: workspace.title,
  resource: workspace.resource,
  attributes: {
    id: workspace.shorthand,
    type: workspace.type,
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
