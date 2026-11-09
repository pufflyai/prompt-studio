import type { ResourceRef } from "@pstdio/workbench";
import type { HarnessParams, Session } from "pstdio-api-contracts";
import { getCollection, getIndexedRows, getRuntimeCollections, type SyncedRow } from "@/lib/sync/collections";
import { createDashboardSessionResource } from "@/shared/app/resources";
import { type DashboardRows, isDashboardProjectRow, isVisibleDashboardRow } from "@/shared/sync/dashboard-rows";
import { type DashboardResourceAnchor, listResourceAnchors } from "@/shared/sync/resource-anchors";
import { sessionDisplayStatus } from "./session-display-status";
export interface DashboardSession {
  device?: Session["device"];
  id: string;
  title: string;
  status: string;
  agent: string | null;
  lastSelectedModel: string | null;
  params?: HarnessParams;
  updatedAt: string;
  lastActivityAt: string;
  workspaceId: string | null;
  workspaceBranch: string | null;
  workspaceShorthand: string;
  anchors: DashboardResourceAnchor[];
  resource: ResourceRef;
}
const latestTimestamp = (...values: unknown[]) =>
  values
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .sort((a, b) => b.localeCompare(a))[0] ?? "";
const createSession = (session: SyncedRow, workspace: SyncedRow | undefined): DashboardSession => {
  const title = (session.title as string | null) ?? "Session";
  const projectId = (session.project_id as string | null | undefined) ?? (workspace?.project_id as string | undefined);
  const updatedAt = (session.updated_at as string) ?? (session.created_at as string) ?? "";
  const anchors = [...listResourceAnchors(session), ...(workspace ? listResourceAnchors(workspace) : [])];
  const parent = anchors[0];
  return {
    device: session.device as Session["device"],
    id: session.id,
    title,
    status: sessionDisplayStatus(session),
    agent: (session.agent as string | null) ?? null,
    lastSelectedModel: (session.last_selected_model as string | null) ?? null,
    params: (session.params_json as HarnessParams | null) ?? {},
    updatedAt,
    lastActivityAt: latestTimestamp(session.last_request_ended, session.last_request_started, updatedAt),
    workspaceId: (workspace?.id as string | undefined) ?? null,
    workspaceBranch: (workspace?.branch as string | null) ?? null,
    workspaceShorthand: (workspace?.workspace_shorthand as string | undefined) ?? "",
    anchors,
    resource: createDashboardSessionResource(session.id, title, projectId, {
      status: sessionDisplayStatus(session),
      ...(parent ? { resourceParent: parent } : {}),
    }),
  };
};
export const buildDashboardSessionsFromRows = (
  rows: Pick<DashboardRows, "sessions" | "workspaces" | "workspaceSessions">,
  options: {
    projectId?: string;
  } = {},
) => {
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
    .sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt) || a.id.localeCompare(b.id));
};
const sessionSnapshots = new WeakMap<
  ReturnType<typeof getRuntimeCollections>,
  { version: string; projects: Map<string | undefined, DashboardSession[]> }
>();
export const createDashboardSessions = (projectId?: string) => {
  const owner = getRuntimeCollections();
  const version = (["sessions", "workspaces", "workspace_sessions"] as const)
    .map((table) => owner.getCollectionVersion(table))
    .join(":");
  let cached = sessionSnapshots.get(owner);
  if (cached?.version !== version) {
    cached = { version, projects: new Map() };
    sessionSnapshots.set(owner, cached);
  }
  const previous = cached.projects.get(projectId);
  if (previous) return previous;
  const sessions = buildDashboardSessionsFromRows(
    {
      sessions: [...getCollection("sessions").values()],
      workspaces: [...getCollection("workspaces").values()],
      workspaceSessions: [...getCollection("workspace_sessions").values()],
    },
    { projectId },
  );
  cached.projects.set(projectId, sessions);
  return sessions;
};
export const findDashboardSession = (sessionId: string | undefined, projectId?: string) => {
  if (!sessionId) return undefined;
  const session = getCollection("sessions").get(sessionId);
  if (!session || !isVisibleDashboardRow(session) || !isDashboardProjectRow(session, projectId)) return undefined;
  const workspaces = getIndexedRows("workspace_sessions", "session_id", sessionId).flatMap((link) => {
    const workspace = getCollection("workspaces").get(String(link.workspace_id));
    return workspace && isVisibleDashboardRow(workspace) ? [workspace] : [];
  });
  return createSession(session, workspaces.at(-1));
};
