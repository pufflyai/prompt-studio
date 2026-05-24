import type { SessionMessage } from "@pstdio/ui/chat-ui";
import type { ResourceRef } from "pstdio-workbench/core";
import type { SyncedRow } from "@/lib/sync/collections";
import {
  type DashboardRows,
  isDashboardProjectRow,
  isVisibleDashboardRow,
  readDashboardRows,
} from "../../../shared/data/dashboard-rows";
import { getDashboardWorkspaceDiffSummary } from "../../../shared/data/workspace-diff-summary-data";
import { createDashboardResource } from "../../../shared/resources";

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

export const buildDashboardSessionsFromRows = (rows: DashboardRows, options: { projectId?: string } = {}) => {
  const workspaceById = new Map(
    rows.workspaces
      .filter((workspace) => isVisibleDashboardRow(workspace) && isDashboardProjectRow(workspace, options.projectId))
      .map((workspace) => [workspace.id, workspace]),
  );
  const workspaceBySessionId = new Map<string, SyncedRow>();

  for (const link of rows.workspaceSessions) {
    const workspace = workspaceById.get(link.workspace_id as string);
    if (workspace) workspaceBySessionId.set(link.session_id as string, workspace);
  }

  return rows.sessions
    .filter((session) => isVisibleDashboardRow(session) && isDashboardProjectRow(session, options.projectId))
    .map((session) => createSession(session, workspaceBySessionId.get(session.id)))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
};

export const createDashboardSessions = (projectId?: string) =>
  buildDashboardSessionsFromRows(readDashboardRows(), { projectId });

export const findDashboardSession = (sessionId: string | undefined) =>
  createDashboardSessions().find((session) => session.id === sessionId);

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

const createUnsyncedSessionView = (sessionId: string): DashboardSessionView => ({
  ...draftSessionView,
  id: sessionId,
  sessionId,
});

const findWorkspaceRow = (rows: DashboardRows, workspaceId: string | null | undefined) => {
  if (!workspaceId) return undefined;
  return rows.workspaces.find((workspace) => isVisibleDashboardRow(workspace) && workspace.id === workspaceId);
};

export const resolveDashboardSessionView = (sessionId: string | undefined): DashboardSessionView => {
  if (!sessionId) return draftSessionView;

  const session = findDashboardSession(sessionId);
  if (!session) return createUnsyncedSessionView(sessionId);

  const rows = readDashboardRows();
  const workspace = findWorkspaceRow(rows, session.workspaceId);
  const summary = session.workspaceId ? getDashboardWorkspaceDiffSummary(session.workspaceId) : undefined;

  return {
    id: session.id,
    sessionId: session.id,
    workspaceTitle: (workspace?.name as string | null) ?? (workspace?.workspace_shorthand as string | undefined) ?? "",
    workspaceId: workspace?.id ?? null,
    workspaceBranch: (workspace?.branch as string | null) ?? session.workspaceBranch ?? null,
    workspaceShorthand: session.workspaceShorthand,
    agent: session.agent,
    lastSelectedModel: session.lastSelectedModel,
    additions: summary?.additions ?? 0,
    deletions: summary?.deletions ?? 0,
    messages: [],
  };
};
