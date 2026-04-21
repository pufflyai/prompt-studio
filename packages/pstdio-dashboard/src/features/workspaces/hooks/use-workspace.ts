import { asSyncedRows, eq, getCollection, useLiveQuery } from "@/features/sync/collections";

interface WorkspaceRecord {
  id: string;
  branch: string | null;
}

export const useWorkspace = (workspaceId: string | null) => {
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
  const workspace = workspaces?.[0];

  if (!workspace) {
    return null;
  }

  return {
    id: workspace.id,
    branch: (workspace.branch as string) ?? null,
  } satisfies WorkspaceRecord;
};
