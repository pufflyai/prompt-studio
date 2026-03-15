import { useMutation } from "@tanstack/react-query";
import { asSyncedRows, getCollection, type SyncedRow, useLiveQuery } from "@/features/sync/collections";
import { createProject, deleteProject } from "../data/api";
import type { ProjectListItem } from "../types";

const toProjectRepoPath = (projectId: string, projectRepoRows: SyncedRow[], repoById: Map<string, SyncedRow>) => {
  const linkedRepoPaths = projectRepoRows
    .filter((row) => (row.project_id as string) === projectId)
    .map((row) => repoById.get(row.repo_id as string)?.path)
    .filter((path): path is string => typeof path === "string");

  return linkedRepoPaths[0] ?? null;
};

const toProjectListItem = (
  row: SyncedRow,
  projectRepoRows: SyncedRow[],
  repoById: Map<string, SyncedRow>,
): ProjectListItem => ({
  id: row.id,
  name: row.name as string,
  createdAt: row.created_at as string,
  updatedAt: row.updated_at as string,
  repoPath: toProjectRepoPath(row.id, projectRepoRows, repoById),
});

export const useProjectList = () => {
  const { data: rawRows, isLoading } = useLiveQuery((q) =>
    q.from({ p: getCollection("projects") }).select(({ p }) => ({ ...p })),
  );
  const { data: rawProjectRepos } = useLiveQuery((q) =>
    q.from({ pr: getCollection("project_repos") }).select(({ pr }) => ({ ...pr })),
  );
  const { data: rawRepos } = useLiveQuery((q) => q.from({ r: getCollection("repos") }).select(({ r }) => ({ ...r })));

  const rows = asSyncedRows(rawRows);
  const projectRepoRows = asSyncedRows(rawProjectRepos) ?? [];
  const repoRows = asSyncedRows(rawRepos) ?? [];
  const repoById = new Map(repoRows.map((repo) => [repo.id, repo]));

  const data = rows
    ? [...rows]
        .map((row) => toProjectListItem(row, projectRepoRows, repoById))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    : undefined;

  return { data, isLoading };
};

export const useCreateProject = () => useMutation({ mutationFn: createProject });

export const useDeleteProject = () =>
  useMutation({
    mutationFn: async ({ projectId }: { projectId: string }) => {
      await deleteProject(projectId);
    },
  });
