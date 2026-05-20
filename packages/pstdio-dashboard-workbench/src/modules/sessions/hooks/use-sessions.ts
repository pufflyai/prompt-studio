import { asSyncedRows, eq, getCollection, type SyncedRow, useLiveQuery } from "@/lib/sync/collections";
import { bool, isNotDeleted, str } from "@/lib/sync/row";

export interface DashboardSession {
  id: string;
  title: string;
  status: string;
  agent?: string;
  archived: boolean;
  updatedAt?: string;
}

const toSession = (row: SyncedRow): DashboardSession => ({
  id: row.id,
  title: str(row.title) ?? "Session",
  status: str(row.status) ?? "unknown",
  agent: str(row.agent),
  archived: bool(row.archived),
  updatedAt: str(row.updated_at),
});

export const toVisibleSessions = (rows: SyncedRow[]): DashboardSession[] => rows.filter(isNotDeleted).map(toSession);

export const useSessions = (projectId: string): DashboardSession[] => {
  const { data } = useLiveQuery((q) =>
    q
      .from({ s: getCollection("sessions") })
      .where(({ s }) => eq(s.project_id, projectId))
      .select(({ s }) => ({ ...s })),
  );
  return toVisibleSessions(asSyncedRows(data) ?? []);
};
