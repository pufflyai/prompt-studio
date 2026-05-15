import { asSyncedRows, getCollection, useLiveQuery } from "@/lib/sync";
import { getVisibleSessions, sortSessionsByUpdatedAt, toSession } from "./session-mappers";

export const useSessions = () => {
  const { data: rawRows, isLoading } = useLiveQuery(
    (query) => query.from({ session: getCollection("sessions") }).select(({ session }) => ({ ...session })),
    [],
  );
  const rows = asSyncedRows(rawRows);
  const sessions = sortSessionsByUpdatedAt(getVisibleSessions((rows ?? []).map(toSession)));

  return { sessions, isLoading };
};
