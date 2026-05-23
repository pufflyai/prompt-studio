import type { DataRendererRow } from "@pstdio/ui";
import type { SessionMessage } from "@pstdio/ui/chat-ui";
import type { ResourceRef } from "pstdio-workbench/core";
import { getCollection, getCollectionsVersion, type SyncedRow, subscribeCollections } from "@/lib/sync/collections";
import { createDashboardResource } from "../shared/resources";
import {
  buildDashboardWorkspaceReviewsFromRows,
  createEmptyDashboardWorkspaceReview,
  type DashboardWorkspaceReview,
} from "./workspace-review-data";

export interface DashboardSession {
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
  status: { name: string; color: string };
  sessionStatus: string;
  ticketId: string | null;
  additions: number;
  deletions: number;
  updatedAt: string;
  branch: string | null;
  worktreePath: string | null;
  setupError: string | null;
  resource: ResourceRef;
  sessions: DashboardSession[];
  review: DashboardWorkspaceReview;
}

export interface DashboardSessionView {
  id: string;
  sessionId: string | undefined;
  workspaceTitle: string;
  workspaceId: string | null;
  workspaceBranch: string | null;
  workspaceShorthand: string;
  agent: string | null;
  lastSelectedModel: string | null;
  additions: number;
  deletions: number;
  messages: SessionMessage[];
}

export interface DashboardWorkspaceRow extends DataRendererRow {
  resource: ResourceRef;
}

export interface DashboardRows {
  attemptStatuses: SyncedRow[];
  files: SyncedRow[];
  sessions: SyncedRow[];
  ticketWorkspaces: SyncedRow[];
  workspaceArtifacts: SyncedRow[];
  workspaceSessions: SyncedRow[];
  workspaces: SyncedRow[];
}

interface DashboardDataOptions {
  projectId?: string;
}

type DashboardDataTable =
  | "attempt_statuses"
  | "files"
  | "sessions"
  | "ticket_workspaces"
  | "workspace_artifacts"
  | "workspace_sessions"
  | "workspaces";

const readRows = (table: DashboardDataTable) => Array.from(getCollection(table).state.values()) as SyncedRow[];

export const readDashboardRows = (): DashboardRows => ({
  attemptStatuses: readRows("attempt_statuses"),
  files: readRows("files"),
  sessions: readRows("sessions"),
  ticketWorkspaces: readRows("ticket_workspaces"),
  workspaceArtifacts: readRows("workspace_artifacts"),
  workspaceSessions: readRows("workspace_sessions"),
  workspaces: readRows("workspaces"),
});

const isVisibleRow = (row: SyncedRow) => row.archived !== true && !row.deleted_at;

const isProjectRow = (row: SyncedRow, projectId: string | undefined) => !projectId || row.project_id === projectId;

const normalizeStatus = (status: string) => status.toLowerCase().replaceAll(/\s+/g, "-");

const resolveWorkspaceStatus = (workspace: SyncedRow, attemptStatusById: Map<string, SyncedRow>) => {
  if (workspace.setup_error) return { name: "Failed", color: "red" };
  if (workspace.initializing === true) return { name: "Running", color: "blue" };

  const status = attemptStatusById.get(workspace.attempt_status_id as string);
  if (status) {
    return {
      name: status.name as string,
      color: (status.color as string) ?? "gray",
    };
  }

  return { name: "Unassigned", color: "gray" };
};

const createSession = (session: SyncedRow, workspace: SyncedRow | undefined): DashboardSession => {
  const title = (session.title as string | null) ?? "Session";
  const projectId = (session.project_id as string | null | undefined) ?? (workspace?.project_id as string | undefined);

  return {
    id: session.id,
    title,
    status: (session.status as string) ?? "unknown",
    agent: (session.agent as string | null) ?? null,
    lastSelectedModel: (session.last_selected_model as string | null) ?? null,
    updatedAt: (session.updated_at as string) ?? (session.created_at as string) ?? "",
    workspaceId: (workspace?.id as string | undefined) ?? null,
    workspaceBranch: (workspace?.branch as string | null) ?? null,
    workspaceShorthand: (workspace?.workspace_shorthand as string | undefined) ?? "",
    resource: createDashboardResource("session", session.id, title, "MessageCircle", projectId),
  };
};

export const buildDashboardSessionsFromRows = (rows: DashboardRows, options: DashboardDataOptions = {}) => {
  const workspaceById = new Map(
    rows.workspaces
      .filter((workspace) => isVisibleRow(workspace) && isProjectRow(workspace, options.projectId))
      .map((workspace) => [workspace.id, workspace]),
  );
  const workspaceBySessionId = new Map<string, SyncedRow>();

  for (const link of rows.workspaceSessions) {
    const workspace = workspaceById.get(link.workspace_id as string);
    if (workspace) workspaceBySessionId.set(link.session_id as string, workspace);
  }

  return rows.sessions
    .filter((session) => isVisibleRow(session) && isProjectRow(session, options.projectId))
    .map((session) => createSession(session, workspaceBySessionId.get(session.id)))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
};

export const buildDashboardWorkspacesFromRows = (rows: DashboardRows, options: DashboardDataOptions = {}) => {
  const attemptStatusById = new Map(
    rows.attemptStatuses
      .filter((status) => isVisibleRow(status) && isProjectRow(status, options.projectId))
      .map((status) => [status.id, status]),
  );
  const reviewByWorkspaceId = buildDashboardWorkspaceReviewsFromRows(rows);
  const sessionById = new Map(
    rows.sessions
      .filter((session) => isVisibleRow(session) && isProjectRow(session, options.projectId))
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
    .filter((workspace) => isVisibleRow(workspace) && isProjectRow(workspace, options.projectId))
    .map((workspace) => {
      const title = (workspace.name as string | null) ?? (workspace.workspace_shorthand as string);
      const sessions = (sessionLinksByWorkspaceId.get(workspace.id) ?? [])
        .sort((a, b) => ((a.created_at as string) ?? "").localeCompare((b.created_at as string) ?? ""))
        .map((link) => sessionById.get(link.session_id as string))
        .filter((session): session is SyncedRow => Boolean(session))
        .map((session) => createSession(session, workspace));
      const [latestSession] = [...sessions].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      const type: DashboardWorkspace["type"] = workspace.worktree_path ? "worktree" : "current_branch";
      const review = reviewByWorkspaceId.get(workspace.id) ?? createEmptyDashboardWorkspaceReview(workspace.id);

      return {
        id: workspace.id,
        title,
        shorthand: workspace.workspace_shorthand as string,
        type,
        status: resolveWorkspaceStatus(workspace, attemptStatusById),
        sessionStatus: latestSession?.status ?? "unknown",
        ticketId: review.ticketId,
        additions: 0,
        deletions: 0,
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
        ),
        sessions,
        review,
      };
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
};

export const createDashboardWorkspaces = (projectId?: string) =>
  buildDashboardWorkspacesFromRows(readDashboardRows(), { projectId });

export const createDashboardSessions = (projectId?: string) =>
  buildDashboardSessionsFromRows(readDashboardRows(), { projectId });

export const findDashboardWorkspace = (resource: ResourceRef, projectId?: string) =>
  createDashboardWorkspaces(projectId).find(
    (workspace) => workspace.resource.uri === resource.uri || workspace.id === resource.id,
  );

export const findDashboardSession = (sessionId: string | undefined) =>
  createDashboardSessions().find((session) => session.id === sessionId);

export const toWorkspaceRow = (workspace: DashboardWorkspace): DashboardWorkspaceRow => ({
  id: workspace.resource.uri,
  ticketId: workspace.shorthand,
  title: workspace.title,
  status: normalizeStatus(workspace.status.name),
  statusColor: workspace.status.color,
  updatedAt: workspace.updatedAt,
  tags: [{ name: "type", value: workspace.type }],
  resource: workspace.resource,
});

export const createWorkspaceRows = (projectId?: string) => createDashboardWorkspaces(projectId).map(toWorkspaceRow);

const draftSessionView: DashboardSessionView = {
  id: "draft",
  sessionId: undefined,
  workspaceTitle: "",
  workspaceId: null,
  workspaceBranch: null,
  workspaceShorthand: "",
  agent: null,
  lastSelectedModel: null,
  additions: 0,
  deletions: 0,
  messages: [],
};

export const resolveDashboardSessionView = (sessionId: string | undefined): DashboardSessionView => {
  const session = findDashboardSession(sessionId);
  if (!session) return draftSessionView;

  const workspace = session.workspaceId
    ? createDashboardWorkspaces().find((entry) => entry.id === session.workspaceId)
    : undefined;

  return {
    id: session.id,
    sessionId: session.id,
    workspaceTitle: workspace?.title ?? "",
    workspaceId: workspace?.id ?? null,
    workspaceBranch: workspace?.branch ?? session.workspaceBranch,
    workspaceShorthand: session.workspaceShorthand,
    agent: session.agent,
    lastSelectedModel: session.lastSelectedModel,
    additions: workspace?.additions ?? 0,
    deletions: workspace?.deletions ?? 0,
    messages: [],
  };
};

export const subscribeDashboardData = subscribeCollections;

export const getDashboardDataVersion = getCollectionsVersion;
