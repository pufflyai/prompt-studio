import { asSyncedRows, eq, getCollection, type SyncedRow, useLiveQuery } from "@/features/sync/collections";
import { findSessionRow } from "@/shared/sessions/session-row-selection";
import type { Session } from "../types";

const toSession = (row: SyncedRow): Session => ({
  id: row.id,
  projectId: (row.project_id as string) ?? null,
  agentSessionId: (row.agent_session_id as string) ?? null,
  title: row.title as string,
  status: row.status as Session["status"],
  archived: row.archived as boolean,
  agent: (row.agent as string) ?? null,
  lastSelectedModel: (row.last_selected_model as string) ?? null,
  createdAt: row.created_at as string,
  updatedAt: row.updated_at as string,
});

export const useProjectSession = (projectId: string | undefined, sessionId: string | null) => {
  const { data: rawRows, isLoading } = useLiveQuery(
    (q) => {
      if (!sessionId) return undefined;

      const query = q.from({ s: getCollection("sessions") });
      if (!projectId) return query.select(({ s }) => ({ ...s }));

      return query.where(({ s }) => eq(s.project_id, projectId)).select(({ s }) => ({ ...s }));
    },
    [projectId, sessionId],
  );
  const rows = asSyncedRows(rawRows);

  const row = findSessionRow(rows, { sessionId, projectId });
  const data = row ? toSession(row) : undefined;

  return { data, isLoading };
};
