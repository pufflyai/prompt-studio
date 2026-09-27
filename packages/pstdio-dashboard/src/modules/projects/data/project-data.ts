import { type ResourceRef, standardResourceIcons } from "@pstdio/workbench";
import { getCollection, type SyncedRow } from "@/lib/sync/collections";
import { createDashboardResource } from "@/shared/app/resources";

export interface DashboardProject {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  folderPath: string | null;
  resource: ResourceRef;
}

export interface DashboardProjectRows {
  projects: SyncedRow[];
  workspaces: SyncedRow[];
}

const readRows = (table: "projects" | "workspaces") => Array.from(getCollection(table).state.values()) as SyncedRow[];

const isVisibleRow = (row: SyncedRow) => !row.deleted_at;

const toDashboardProject = (row: SyncedRow, folderPathByProjectId: ReadonlyMap<string, string>): DashboardProject => {
  const name = row.name as string;

  return {
    id: row.id,
    name,
    createdAt: (row.created_at as string) ?? "",
    updatedAt: (row.updated_at as string) ?? "",
    folderPath: folderPathByProjectId.get(row.id) ?? null,
    resource: createDashboardResource("project", row.id, name, standardResourceIcons.project, row.id),
  };
};

export const readDashboardProjectRows = (): DashboardProjectRows => ({
  projects: readRows("projects"),
  workspaces: readRows("workspaces"),
});

export const buildDashboardProjectsFromRows = (rows: DashboardProjectRows) => {
  const folderPathByProjectId = new Map(
    rows.workspaces
      .filter((row) => row.is_default && !row.deleted_at)
      .map((row) => [row.project_id as string, (row.root_path ?? row.display_path ?? "") as string]),
  );
  return rows.projects
    .filter(isVisibleRow)
    .map((project) => toDashboardProject(project, folderPathByProjectId))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

export const createDashboardProjects = () => buildDashboardProjectsFromRows(readDashboardProjectRows());

export const findDashboardProject = (projectId: string | undefined) =>
  createDashboardProjects().find((project) => project.id === projectId);
