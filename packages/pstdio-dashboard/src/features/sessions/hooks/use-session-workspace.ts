import { asSyncedRows, eq, getCollection, type SyncedRow, useLiveQuery } from "@/features/sync/collections";

interface SessionWorkspace {
  id: string;
  branch: string | null;
}

const toSessionWorkspace = (row: SyncedRow): SessionWorkspace => ({
  id: row.id,
  branch: (row.branch as string) ?? null,
});

export const useSessionWorkspace = (sessionId: string | null) => {
  const { data: rawRows } = useLiveQuery(
    (q) =>
      sessionId
        ? q
            .from({ w: getCollection("workspaces") })
            .where(({ w }) => eq(w.session_id, sessionId))
            .select(({ w }) => ({ ...w }))
        : undefined,
    [sessionId],
  );
  const rows = asSyncedRows(rawRows);

  return rows?.[0] ? toSessionWorkspace(rows[0]) : null;
};
