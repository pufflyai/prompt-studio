import { and, eq } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { project_repos, repos } from "../../db/schemas.pg";

const nowTimestamp = () => new Date().toISOString();

export const createReposDBService = (db: DbClient) => {
  const registerForProject = async (projectId: string, input: { name: string; path: string }) =>
    db.transaction(async (tx) => {
      const timestamp = nowTimestamp();

      const [existingRepo] = await tx.select().from(repos).where(eq(repos.path, input.path));
      let repo = existingRepo;

      if (!repo) {
        repo = {
          id: crypto.randomUUID(),
          name: input.name,
          display_name: null,
          path: input.path,
          created_at: timestamp,
          updated_at: timestamp,
        };
        await tx.insert(repos).values(repo);
      }

      const [existingLink] = await tx
        .select()
        .from(project_repos)
        .where(and(eq(project_repos.project_id, projectId), eq(project_repos.repo_id, repo.id)));

      if (!existingLink) {
        await tx.insert(project_repos).values({
          id: crypto.randomUUID(),
          project_id: projectId,
          repo_id: repo.id,
          created_at: timestamp,
        });
      }

      return repo;
    });

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
    const [removed] = await db
      .delete(project_repos)
      .where(and(eq(project_repos.project_id, projectId), eq(project_repos.repo_id, repoId)))
      .returning();
    return removed ?? null;
  };

  const list = () => db.select().from(repos);

  return { get, registerForProject, listByProject, getProjectRepoLink, removeFromProject, list };
};
