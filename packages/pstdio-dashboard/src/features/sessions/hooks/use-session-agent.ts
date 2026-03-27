import { asSyncedRows, eq, getCollection, useLiveQuery } from "@/features/sync/collections";

export const useSessionAgent = (sessionId: string | null) => {
  const { data: rawRows } = useLiveQuery(
    (q) =>
      sessionId
        ? q
            .from({ s: getCollection("sessions") })
            .where(({ s }) => eq(s.id, sessionId))
            .select(({ s }) => ({ ...s }))
        : undefined,
    [sessionId],
  );
  const rows = asSyncedRows(rawRows);

  return rows?.[0] ? ((rows[0].agent as string) ?? null) : null;
};
