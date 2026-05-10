import { asSyncedRows, eq, getCollection, type SyncedRow, useLiveQuery } from "@/features/sync/collections";
import type { Session } from "./session-types";

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

export const useProjectSessions = (projectId: string | undefined) => {
  const { data: rawRows, isLoading } = useLiveQuery(
    (q) =>
      projectId
        ? q
            .from({ s: getCollection("sessions") })
            .where(({ s }) => eq(s.project_id, projectId))
            .select(({ s }) => ({ ...s }))
        : undefined,
    [projectId],
  );
  const rows = asSyncedRows(rawRows);

  const data = rows?.map(toSession);

  return { data, isLoading };
};
