import { asSyncedRows, eq, getCollection, type SyncedRow, useLiveQuery } from "@/lib/sync/collections";
import { str } from "@/lib/sync/row";

export interface DashboardProject {
  id: string;
  name: string;
  shorthand: string;
}

const toProject = (row: SyncedRow): DashboardProject => ({
  id: row.id,
  name: str(row.name) ?? "Untitled project",
  shorthand: str(row.shorthand) ?? row.id,
});

export const useProjects = (): DashboardProject[] => {
  const { data } = useLiveQuery((q) => q.from({ p: getCollection("projects") }).select(({ p }) => ({ ...p })));
  return (asSyncedRows(data) ?? []).filter((row) => !row.deleted_at).map(toProject);
};

export const useProject = (projectId: string): DashboardProject | undefined =>
  useProjects().find((project) => project.id === projectId);

export const useProjectTicketCount = (projectId: string): number => {
  const { data } = useLiveQuery((q) =>
    q
      .from({ t: getCollection("tickets") })
      .where(({ t }) => eq(t.project_id, projectId))
      .select(({ t }) => ({ ...t })),
  );
  return (asSyncedRows(data) ?? []).filter((row) => !row.deleted_at && row.archived !== true).length;
};
