import { asSyncedRows, eq, getCollection, type SyncedRow, useLiveQuery } from "@/features/sync/collections";
import type { Session } from "../types";

const toSession = (row: SyncedRow): Session => ({
  id: row.id,
  projectId: (row.project_id as string) ?? null,
  agentSessionId: (row.agent_session_id as string) ?? null,
  title: row.title as string,
  status: row.status as Session["status"],
  archived: row.archived as boolean,
  agent: (row.agent as string) ?? null,
  createdAt: row.created_at as string,
  updatedAt: row.updated_at as string,
});

export const useProjectSession = (projectId: string | undefined, sessionId: string | null) => {
  const { data: rawRows, isLoading } = useLiveQuery(
    (q) =>
      projectId && sessionId
        ? q
            .from({ s: getCollection("sessions") })
            .where(({ s }) => eq(s.id, sessionId))
            .select(({ s }) => ({ ...s }))
        : undefined,
    [projectId, sessionId],
  );
  const rows = asSyncedRows(rawRows);

  const data = rows?.[0] ? toSession(rows[0]) : undefined;

  return { data, isLoading };
};
