import { type ResourceRef, standardResourceIcons } from "@pstdio/workbench";
import { getCollection, type SyncedRow } from "@/lib/sync/collections";
import { createDashboardResource } from "@/shared/app/resources";
import { findFirstProjectRepoPath } from "@/shared/projects/project-repo-path";

export interface DashboardProject {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  repoPath: string | null;
  resource: ResourceRef;
}

export interface DashboardProjectRows {
  projects: SyncedRow[];
  projectRepos: SyncedRow[];
  repos: SyncedRow[];
}

const readRows = (table: "projects" | "project_repos" | "repos") =>
  Array.from(getCollection(table).state.values()) as SyncedRow[];

const isVisibleRow = (row: SyncedRow) => !row.deleted_at;

const toDashboardProject = (row: SyncedRow, projectRepoRows: SyncedRow[], repoRows: SyncedRow[]): DashboardProject => {
  const name = row.name as string;

  return {
    id: row.id,
    name,
    createdAt: (row.created_at as string) ?? "",
    updatedAt: (row.updated_at as string) ?? "",
    repoPath: findFirstProjectRepoPath(row.id, projectRepoRows, repoRows),
    resource: createDashboardResource("project", row.id, name, standardResourceIcons.project, row.id),
  };
};

export const readDashboardProjectRows = (): DashboardProjectRows => ({
  projects: readRows("projects"),
  projectRepos: readRows("project_repos"),
  repos: readRows("repos"),
});

export const buildDashboardProjectsFromRows = (rows: DashboardProjectRows) => {
  return rows.projects
    .filter(isVisibleRow)
    .map((project) => toDashboardProject(project, rows.projectRepos, rows.repos))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

export const createDashboardProjects = () => buildDashboardProjectsFromRows(readDashboardProjectRows());

export const findDashboardProject = (projectId: string | undefined) =>
  createDashboardProjects().find((project) => project.id === projectId);
