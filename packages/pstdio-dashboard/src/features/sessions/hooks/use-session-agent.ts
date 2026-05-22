import { asSyncedRows, getCollection, useLiveQuery } from "@/features/sync/collections";
import { findSessionRow } from "@/shared/sessions/session-row-selection";

export const useSessionAgent = (sessionId: string | null) => {
  const { data: rawRows } = useLiveQuery(
    (q) => (sessionId ? q.from({ s: getCollection("sessions") }).select(({ s }) => ({ ...s })) : undefined),
    [sessionId],
  );
  const rows = asSyncedRows(rawRows);
  const row = findSessionRow(rows, { sessionId });

  return row ? ((row.agent as string) ?? null) : null;
};
