import type { createReposDBService } from "pstdio-db";
import type { EventBus } from "../features/sync/event-bus";

export type RepoServiceDeps = {
  reposDBService: ReturnType<typeof createReposDBService>;
  eventBus: EventBus;
};

export const createRepoService = (deps: RepoServiceDeps) => {
  const db = deps.reposDBService;
  const registerForProject = async (...args: Parameters<typeof db.registerForProject>) => {
    const repo = await db.registerForProject(...args);
    const link = await db.getProjectRepoLink(args[0], repo.id);
    deps.eventBus.emit("repos", "set", repo);
    if (link) deps.eventBus.emit("project_repos", "set", link);
    return repo;
  };
  const removeFromProject = async (...args: Parameters<typeof db.removeFromProject>) => {
    const link = await db.removeFromProject(...args);
    if (link) deps.eventBus.emit("project_repos", "delete", { id: link.id });
  };
  return { ...db, registerForProject, removeFromProject };
};
