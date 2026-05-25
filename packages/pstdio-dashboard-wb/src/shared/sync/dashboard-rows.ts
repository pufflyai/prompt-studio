import { getCollection, getCollectionsVersion, type SyncedRow, subscribeCollections } from "@/lib/sync/collections";

export interface DashboardRows {
  files: SyncedRow[];
  sessions: SyncedRow[];
  ticketWorkspaces: SyncedRow[];
  workspaceArtifacts: SyncedRow[];
  workspaceSessions: SyncedRow[];
  workspaces: SyncedRow[];
}

type DashboardDataTable =
  | "files"
  | "sessions"
  | "ticket_workspaces"
  | "workspace_artifacts"
  | "workspace_sessions"
  | "workspaces";

const readRows = (table: DashboardDataTable) => Array.from(getCollection(table).state.values()) as SyncedRow[];

export const readDashboardRows = (): DashboardRows => ({
  files: readRows("files"),
  sessions: readRows("sessions"),
  ticketWorkspaces: readRows("ticket_workspaces"),
  workspaceArtifacts: readRows("workspace_artifacts"),
  workspaceSessions: readRows("workspace_sessions"),
  workspaces: readRows("workspaces"),
});

export const isVisibleDashboardRow = (row: SyncedRow) => row.archived !== true && !row.deleted_at;

export const isDashboardProjectRow = (row: SyncedRow, projectId: string | undefined) =>
  !projectId || row.project_id === projectId;

export const subscribeDashboardData = subscribeCollections;

export const getDashboardDataVersion = getCollectionsVersion;
