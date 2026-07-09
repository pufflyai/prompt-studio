import { type ResourceRef, standardResourceIcons } from "@pstdio/workbench/core";
import { getCollection, type SyncedRow } from "@/lib/sync/collections";
import { createDashboardResource } from "@/shared/app/resources";

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

const toProjectRepoPath = (projectId: string, projectRepoRows: SyncedRow[], repoById: Map<string, SyncedRow>) => {
  const linkedRepoPaths = projectRepoRows
    .filter((row) => row.project_id === projectId)
    .map((row) => repoById.get(row.repo_id as string)?.path)
    .filter((path): path is string => typeof path === "string");

  return linkedRepoPaths[0] ?? null;
};

const toDashboardProject = (
  row: SyncedRow,
  projectRepoRows: SyncedRow[],
  repoById: Map<string, SyncedRow>,
): DashboardProject => {
  const name = row.name as string;

  return {
    id: row.id,
    name,
    createdAt: (row.created_at as string) ?? "",
    updatedAt: (row.updated_at as string) ?? "",
    repoPath: toProjectRepoPath(row.id, projectRepoRows, repoById),
    resource: createDashboardResource("project", row.id, name, standardResourceIcons.project, row.id),
  };
};

export const readDashboardProjectRows = (): DashboardProjectRows => ({
  projects: readRows("projects"),
  projectRepos: readRows("project_repos"),
  repos: readRows("repos"),
});

export const buildDashboardProjectsFromRows = (rows: DashboardProjectRows) => {
  const repoById = new Map(rows.repos.filter(isVisibleRow).map((repo) => [repo.id, repo]));

  return rows.projects
    .filter(isVisibleRow)
    .map((project) => toDashboardProject(project, rows.projectRepos, repoById))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

export const createDashboardProjects = () => buildDashboardProjectsFromRows(readDashboardProjectRows());

export const findDashboardProject = (projectId: string | undefined) =>
  createDashboardProjects().find((project) => project.id === projectId);
