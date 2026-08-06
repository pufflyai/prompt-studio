import type { SyncedRow } from "@/lib/sync/collections";

export const indexFirstProjectRepoPaths = (projectRepoRows: SyncedRow[], repoRows: SyncedRow[]) => {
  const repoById = new Map(repoRows.filter((repo) => !repo.deleted_at).map((repo) => [repo.id, repo]));
  const pathByProjectId = new Map<string, string>();

  for (const row of projectRepoRows) {
    if (row.deleted_at || typeof row.project_id !== "string" || pathByProjectId.has(row.project_id)) continue;

    const path = repoById.get(row.repo_id as string)?.path;
    if (typeof path === "string") pathByProjectId.set(row.project_id, path);
  }

  return pathByProjectId;
};
