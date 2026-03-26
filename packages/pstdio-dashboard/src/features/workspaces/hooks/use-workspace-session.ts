import { asSyncedRows, eq, getCollection, useLiveQuery } from "@/features/sync/collections";

export const useWorkspaceSession = (workspaceId: string | null) => {
  const { data: rawLinks } = useLiveQuery(
    (q) =>
      workspaceId
        ? q
            .from({ ws: getCollection("workspace_sessions") })
            .where(({ ws }) => eq(ws.workspace_id, workspaceId))
            .select(({ ws }) => ({ ...ws }))
        : undefined,
    [workspaceId],
  );
  const links = asSyncedRows(rawLinks);

  // Return the latest session link (last by created_at)
  const sorted = [...(links ?? [])].sort((a, b) => (b.created_at as string).localeCompare(a.created_at as string));

  return (sorted[0]?.session_id as string) ?? null;
};
