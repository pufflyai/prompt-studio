import type { DataRendererRow } from "@pstdio/ui";
import type { SessionMessage } from "@pstdio/ui/chat-ui";
import type { ResourceRef } from "pstdio-workbench/core";
import { getCollection, getCollectionsVersion, type SyncedRow, subscribeCollections } from "@/lib/sync/collections";
import { createDashboardResource } from "../shared/resources";

export interface DashboardSession {
  id: string;
  title: string;
  status: string;
  updatedAt: string;
  workspaceId: string | null;
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
  additions: number;
  deletions: number;
  updatedAt: string;
  worktreePath: string | null;
  setupError: string | null;
  resource: ResourceRef;
  sessions: DashboardSession[];
}

export interface DashboardSessionView {
  id: string;
  workspaceTitle: string;
  workspaceShorthand: string;
  additions: number;
  deletions: number;
  messages: SessionMessage[];
}

export interface DashboardWorkspaceRow extends DataRendererRow {
  resource: ResourceRef;
}

export interface DashboardSessionRow extends DataRendererRow {
  resource: ResourceRef;
}

export interface DashboardRows {
  attemptStatuses: SyncedRow[];
  sessions: SyncedRow[];
  workspaceSessions: SyncedRow[];
  workspaces: SyncedRow[];
}

const readRows = (table: "attempt_statuses" | "sessions" | "workspace_sessions" | "workspaces") =>
  Array.from(getCollection(table).state.values()) as SyncedRow[];

export const readDashboardRows = (): DashboardRows => ({
  attemptStatuses: readRows("attempt_statuses"),
  sessions: readRows("sessions"),
  workspaceSessions: readRows("workspace_sessions"),
  workspaces: readRows("workspaces"),
});

const isVisibleRow = (row: SyncedRow) => row.archived !== true && !row.deleted_at;

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

const sessionStatusColor = (status: string) => {
  if (status === "completed") return "green";
  if (status === "failed") return "red";
  if (status === "cancelled" || status === "disconnected") return "yellow";
  if (status === "queued") return "yellow";
  if (status === "awaiting_input") return "purple";
  return "blue";
};

const createSession = (session: SyncedRow, workspace: SyncedRow | undefined): DashboardSession => {
  const title = (session.title as string | null) ?? "Session";
  const projectId = (session.project_id as string | null | undefined) ?? (workspace?.project_id as string | undefined);

  return {
    id: session.id,
    title,
    status: (session.status as string) ?? "unknown",
    updatedAt: (session.updated_at as string) ?? (session.created_at as string) ?? "",
    workspaceId: (workspace?.id as string | undefined) ?? null,
    workspaceShorthand: (workspace?.workspace_shorthand as string | undefined) ?? "",
    resource: createDashboardResource("session", session.id, title, "MessageCircle", projectId),
  };
};

export const buildDashboardSessionsFromRows = (rows: DashboardRows) => {
  const workspaceById = new Map(rows.workspaces.filter(isVisibleRow).map((workspace) => [workspace.id, workspace]));
  const workspaceBySessionId = new Map<string, SyncedRow>();

  for (const link of rows.workspaceSessions) {
    const workspace = workspaceById.get(link.workspace_id as string);
    if (workspace) workspaceBySessionId.set(link.session_id as string, workspace);
  }

  return rows.sessions
    .filter(isVisibleRow)
    .map((session) => createSession(session, workspaceBySessionId.get(session.id)))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
};

export const buildDashboardWorkspacesFromRows = (rows: DashboardRows) => {
  const attemptStatusById = new Map(rows.attemptStatuses.filter(isVisibleRow).map((status) => [status.id, status]));
  const sessionById = new Map(rows.sessions.filter(isVisibleRow).map((session) => [session.id, session]));
  const sessionLinksByWorkspaceId = new Map<string, SyncedRow[]>();

  for (const link of rows.workspaceSessions) {
    const workspaceId = link.workspace_id as string;
    const links = sessionLinksByWorkspaceId.get(workspaceId) ?? [];
    links.push(link);
    sessionLinksByWorkspaceId.set(workspaceId, links);
  }

  return rows.workspaces
    .filter(isVisibleRow)
    .map((workspace) => {
      const title = (workspace.name as string | null) ?? (workspace.workspace_shorthand as string);
      const sessions = (sessionLinksByWorkspaceId.get(workspace.id) ?? [])
        .sort((a, b) => ((a.created_at as string) ?? "").localeCompare((b.created_at as string) ?? ""))
        .map((link) => sessionById.get(link.session_id as string))
        .filter((session): session is SyncedRow => Boolean(session))
        .map((session) => createSession(session, workspace));
      const [latestSession] = [...sessions].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      const type: DashboardWorkspace["type"] = workspace.worktree_path ? "worktree" : "current_branch";

      return {
        id: workspace.id,
        title,
        shorthand: workspace.workspace_shorthand as string,
        type,
        status: resolveWorkspaceStatus(workspace, attemptStatusById),
        sessionStatus: latestSession?.status ?? "unknown",
        additions: 0,
        deletions: 0,
        updatedAt: (workspace.updated_at as string) ?? "",
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
      };
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
};

export const createDashboardWorkspaces = () => buildDashboardWorkspacesFromRows(readDashboardRows());

export const createDashboardSessions = () => buildDashboardSessionsFromRows(readDashboardRows());

export const findDashboardWorkspace = (resource: ResourceRef) =>
  createDashboardWorkspaces().find(
    (workspace) => workspace.resource.uri === resource.uri || workspace.id === resource.id,
  );

export const findDashboardSession = (sessionId: string | undefined) =>
  createDashboardSessions().find((session) => session.id === sessionId);

export const toWorkspaceRow = (workspace: DashboardWorkspace): DashboardWorkspaceRow => ({
  id: workspace.resource.uri,
  ticketId: workspace.shorthand,
  title: workspace.title,
  parentPath: ["Workspaces"],
  status: normalizeStatus(workspace.status.name),
  statusColor: workspace.status.color,
  updatedAt: workspace.updatedAt,
  tags: [{ name: "type", value: workspace.type }],
  resource: workspace.resource,
});

export const createWorkspaceRows = () => createDashboardWorkspaces().map(toWorkspaceRow);

export const toSessionRow = (session: DashboardSession): DashboardSessionRow => ({
  id: session.resource.uri,
  ticketId: session.workspaceShorthand,
  title: session.title,
  parentPath: ["Sessions"],
  status: session.status,
  statusColor: sessionStatusColor(session.status),
  updatedAt: session.updatedAt,
  resource: session.resource,
});

export const createSessionRows = () => createDashboardSessions().map(toSessionRow);

const draftSessionView: DashboardSessionView = {
  id: "draft",
  workspaceTitle: "",
  workspaceShorthand: "",
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
    workspaceTitle: workspace?.title ?? "",
    workspaceShorthand: session.workspaceShorthand,
    additions: workspace?.additions ?? 0,
    deletions: workspace?.deletions ?? 0,
    messages: [],
  };
};

export const subscribeDashboardData = subscribeCollections;

export const getDashboardDataVersion = getCollectionsVersion;
