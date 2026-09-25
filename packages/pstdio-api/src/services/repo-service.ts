import type { createReposDBService } from "pstdio-db";
import type { EventBus } from "../features/sync/event-bus";

export type RepoServiceDeps = {
  reposDBService: ReturnType<typeof createReposDBService>;
  eventBus: EventBus;
};

export const createRepoService = (deps: RepoServiceDeps) => {
  const db = deps.reposDBService;
  const register = async (
    projectId: string,
    input: Parameters<typeof db.registerForProject>[1],
    initialize?: (repo: NonNullable<Awaited<ReturnType<typeof db.get>>>) => Promise<void>,
  ) => {
    const { repo, createdRepo, createdLink } = await db.registerForProject(projectId, input);
    try {
      await initialize?.(repo);
    } catch (error) {
      if (createdLink) await db.removeFromProject(projectId, repo.id);
      if (createdRepo) await db.hardDelete(repo.id);
      throw error;
    }
    const link = await db.getProjectRepoLink(projectId, repo.id);
    deps.eventBus.emit("repos", "set", repo);
    if (link) deps.eventBus.emit("project_repos", "set", link);
    return repo;
  };
  // Initialization and rollback share ownership of these rows. A later registration
  // of the same path must wait until that ownership has been settled.
  const registrations = new Map<string, Promise<unknown>>();
  const registerForProject = (...args: Parameters<typeof register>) => {
    const path = args[1].path;
    const previous = registrations.get(path) ?? Promise.resolve();
    const pending = previous.catch(() => undefined).then(() => register(...args));
    registrations.set(path, pending);
    return pending.finally(() => {
      if (registrations.get(path) === pending) registrations.delete(path);
    });
  };
  const removeFromProject = async (...args: Parameters<typeof db.removeFromProject>) => {
    const link = await db.removeFromProject(...args);
    if (link) deps.eventBus.emit("project_repos", "delete", { id: link.id });
  };
  return { ...db, registerForProject, removeFromProject };
};
