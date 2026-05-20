import { asSyncedRows, eq, getCollection, type SyncedRow, useLiveQuery } from "@/lib/sync/collections";
import { bool, str } from "@/lib/sync/row";

export interface DashboardTicket {
  id: string;
  shorthand: string;
  title: string;
  statusId?: string;
  prompt?: string;
  archived: boolean;
  draft: boolean;
  blockedReason?: string;
  updatedAt?: string;
}

export interface DashboardStatus {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  isDefault: boolean;
}

const toTicket = (row: SyncedRow): DashboardTicket => ({
  id: row.id,
  shorthand: str(row.shorthand) ?? row.id,
  title: str(row.display_title) ?? str(row.shorthand) ?? "Untitled ticket",
  statusId: str(row.status_id),
  prompt: str(row.user_prompt),
  archived: bool(row.archived),
  draft: bool(row.draft),
  blockedReason: str(row.blocked_reason),
  updatedAt: str(row.updated_at),
});

const toStatus = (row: SyncedRow): DashboardStatus => ({
  id: row.id,
  name: str(row.name) ?? "Status",
  color: str(row.color) ?? "gray",
  sortOrder: typeof row.sort_order === "number" ? row.sort_order : 0,
  isDefault: bool(row.is_default),
});

export const useTickets = (projectId: string): DashboardTicket[] => {
  const { data } = useLiveQuery((q) =>
    q
      .from({ t: getCollection("tickets") })
      .where(({ t }) => eq(t.project_id, projectId))
      .select(({ t }) => ({ ...t })),
  );
  return (asSyncedRows(data) ?? []).filter((row) => !row.deleted_at).map(toTicket);
};

export const useTicketStatuses = (projectId: string): DashboardStatus[] => {
  const { data } = useLiveQuery((q) =>
    q
      .from({ s: getCollection("ticket_statuses") })
      .where(({ s }) => eq(s.project_id, projectId))
      .select(({ s }) => ({ ...s })),
  );
  return (asSyncedRows(data) ?? [])
    .filter((row) => !row.deleted_at)
    .map(toStatus)
    .sort((left, right) => left.sortOrder - right.sortOrder);
};
