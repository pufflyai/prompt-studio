import { asSyncedRows, eq, getCollection, type SyncedRow, useLiveQuery } from "@/lib/sync/collections";
import { bool, str } from "@/lib/sync/row";

export interface DashboardWorkspace {
  id: string;
  name: string;
  shorthand: string;
  branch?: string;
  worktreePath?: string;
  attemptStatusId?: string;
  archived: boolean;
  initializing: boolean;
}

const toWorkspace = (row: SyncedRow): DashboardWorkspace => ({
  id: row.id,
  name: str(row.name) ?? "Workspace",
  shorthand: str(row.workspace_shorthand) ?? row.id,
  branch: str(row.branch),
  worktreePath: str(row.worktree_path),
  attemptStatusId: str(row.attempt_status_id),
  archived: bool(row.archived),
  initializing: bool(row.initializing),
});

export const useWorkspaces = (projectId: string): DashboardWorkspace[] => {
  const { data } = useLiveQuery((q) =>
    q
      .from({ w: getCollection("workspaces") })
      .where(({ w }) => eq(w.project_id, projectId))
      .select(({ w }) => ({ ...w })),
  );
  return (asSyncedRows(data) ?? []).filter((row) => !row.deleted_at).map(toWorkspace);
};
