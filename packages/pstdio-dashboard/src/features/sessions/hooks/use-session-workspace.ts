import { asSyncedRows, eq, getCollection, type SyncedRow, useLiveQuery } from "@/features/sync/collections";

interface SessionWorkspace {
  id: string;
  branch: string | null;
  workspaceShorthand: string | null;
  initializing: boolean;
}

const toSessionWorkspace = (row: SyncedRow): SessionWorkspace => ({
  id: row.id,
  branch: (row.branch as string) ?? null,
  workspaceShorthand: (row.workspace_shorthand as string) ?? null,
  initializing: (row.initializing as boolean) ?? false,
});

export const useSessionWorkspace = (sessionId: string | null) => {
  const { data: rawLinks } = useLiveQuery(
    (q) =>
      sessionId
        ? q
            .from({ ws: getCollection("workspace_sessions") })
            .where(({ ws }) => eq(ws.session_id, sessionId))
            .select(({ ws }) => ({ ...ws }))
        : undefined,
    [sessionId],
  );
  const links = asSyncedRows(rawLinks);
  const workspaceId = (links?.[0]?.workspace_id as string) ?? null;

  const { data: rawWorkspaces } = useLiveQuery(
    (q) =>
      workspaceId
        ? q
            .from({ w: getCollection("workspaces") })
            .where(({ w }) => eq(w.id, workspaceId))
            .select(({ w }) => ({ ...w }))
        : undefined,
    [workspaceId],
  );
  const workspaces = asSyncedRows(rawWorkspaces);

  return workspaces?.[0] ? toSessionWorkspace(workspaces[0]) : null;
};
