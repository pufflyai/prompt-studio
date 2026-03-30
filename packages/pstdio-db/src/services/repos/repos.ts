import { and, eq } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { project_repos, repos } from "../../db/schemas.pg";

const nowTimestamp = () => new Date().toISOString();

export const createReposDBService = (db: DbClient) => {
  const findByPath = async (path: string) => {
    const [repo] = await db.select().from(repos).where(eq(repos.path, path));
    return repo ?? null;
  };

  const registerForProject = async (projectId: string, input: { name: string; path: string }) => {
    const timestamp = nowTimestamp();

    let repo = await findByPath(input.path);

    if (!repo) {
      repo = {
        id: crypto.randomUUID(),
        name: input.name,
        display_name: null,
        path: input.path,
        created_at: timestamp,
        updated_at: timestamp,
      };
      await db.insert(repos).values(repo);
    }

    const [existingLink] = await db
      .select()
      .from(project_repos)
      .where(and(eq(project_repos.project_id, projectId), eq(project_repos.repo_id, repo.id)));

    if (!existingLink) {
      await db.insert(project_repos).values({
        id: crypto.randomUUID(),
        project_id: projectId,
        repo_id: repo.id,
        created_at: timestamp,
      });
    }

    return repo;
  };

  const listByProject = async (projectId: string) => {
    const rows = await db
      .select({ repo: repos })
      .from(project_repos)
      .innerJoin(repos, eq(project_repos.repo_id, repos.id))
      .where(eq(project_repos.project_id, projectId));

    return rows.map((r) => r.repo);
  };

  const get = async (repoId: string) => {
    const [repo] = await db.select().from(repos).where(eq(repos.id, repoId));
    return repo ?? null;
  };

  const getProjectRepoLink = async (projectId: string, repoId: string) => {
    const [link] = await db
      .select()
      .from(project_repos)
      .where(and(eq(project_repos.project_id, projectId), eq(project_repos.repo_id, repoId)));
    return link ?? null;
  };

  const removeFromProject = async (projectId: string, repoId: string) => {
    await db
      .delete(project_repos)
      .where(and(eq(project_repos.project_id, projectId), eq(project_repos.repo_id, repoId)));
  };

  return { get, registerForProject, listByProject, getProjectRepoLink, removeFromProject };
};
