import { asSyncedRows, eq, getCollection, useLiveQuery } from "@/features/sync/collections";
import type { SessionStatus } from "../types";

export const useSessionStatus = (sessionId: string | null) => {
  const { data: rawRows } = useLiveQuery(
    (q) =>
      sessionId
        ? q
            .from({ s: getCollection("sessions") })
            .where(({ s }) => eq(s.id, sessionId))
            .select(({ s }) => ({ status: s.status }))
        : undefined,
    [sessionId],
  );
  const rows = asSyncedRows(rawRows);

  return rows?.[0] ? ((rows[0].status as SessionStatus) ?? null) : null;
};
