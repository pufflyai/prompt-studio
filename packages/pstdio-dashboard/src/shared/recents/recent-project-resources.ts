import type { ResourceRef } from "@pstdio/workbench";
import type { SyncedRow } from "@/lib/sync/collections";
import { createDashboardResource } from "@/shared/app/resources";
import {
  type DashboardRows,
  isDashboardProjectRow,
  isVisibleDashboardRow,
  readDashboardRows,
} from "@/shared/sync/dashboard-rows";

export interface RecentProjectResource {
  id: string;
  title: string;
  kindLabel: string;
  icon: string;
  updatedAt: string;
  resource: ResourceRef;
}

export const recentProjectResourceLimit = 5;

const rowString = (value: unknown) => (typeof value === "string" ? value : "");

const createSessionRecent = (row: SyncedRow, projectId: string | undefined): RecentProjectResource => {
  const title = rowString(row.title) || "Session";
  const status = rowString(row.status) || "unknown";
  const sessionProjectId = rowString(row.project_id) || projectId;

  return {
    id: row.id,
    title,
    kindLabel: "Session",
    icon: "MessageCircle",
    updatedAt: rowString(row.updated_at) || rowString(row.created_at),
    resource: createDashboardResource("session", row.id, title, "MessageCircle", sessionProjectId, { status }),
  };
};

// Sessions are the only project resource the dashboard syncs with an update
// timestamp, so they are the recents it can order today. The shape stays
// resource-kind agnostic so other kinds join without changing callers.
export const createRecentProjectResources = (
  rows: DashboardRows,
  projectId: string | undefined,
  limit = recentProjectResourceLimit,
) =>
  rows.sessions
    .filter((row) => isVisibleDashboardRow(row) && isDashboardProjectRow(row, projectId))
    .map((row) => createSessionRecent(row, projectId))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, limit);

// The data version is unused: it ties the recompute to the sync store version so
// callers re-read whenever synced rows change.
export const readRecentProjectResources = (projectId: string | undefined, _dataVersion: number) =>
  createRecentProjectResources(readDashboardRows(), projectId);
