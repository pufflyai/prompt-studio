import type { SyncedRow } from "@/lib/sync/collections";

export const findFirstProjectRepoPath = (projectId: string, projectRepoRows: SyncedRow[], repoRows: SyncedRow[]) => {
  const repoById = new Map(repoRows.filter((repo) => !repo.deleted_at).map((repo) => [repo.id, repo]));
  const linkedRepo = projectRepoRows
    .filter((row) => !row.deleted_at && row.project_id === projectId)
    .map((row) => repoById.get(row.repo_id as string))
    .find((repo) => typeof repo?.path === "string");

  return (linkedRepo?.path as string | undefined) ?? null;
};
