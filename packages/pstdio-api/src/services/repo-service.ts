import type { createReposDBService } from "pstdio-db";
import type { EventBus } from "../features/sync/event-bus";
import type { createRepoRegistration, RepoRegistrationScope } from "./repo-registration";

export type RepoServiceDeps = {
  reposDBService: ReturnType<typeof createReposDBService>;
  eventBus: EventBus;
  runRegistration: ReturnType<typeof createRepoRegistration>;
};

type Repo = NonNullable<Awaited<ReturnType<RepoServiceDeps["reposDBService"]["get"]>>>;
interface RegistrationSetup {
  prepare?: () => Promise<(() => Promise<void>) | void>;
  initialize?: (repo: Repo, scope: RepoRegistrationScope) => Promise<void>;
}

export const createRepoService = (deps: RepoServiceDeps) => {
  const db = deps.reposDBService;
  const register = async (
    projectId: string,
    input: Parameters<typeof db.registerForProject>[1],
    setup: RegistrationSetup = {},
  ) => {
    // Filesystem checks and installation share the path lock but must not hold the DB transaction.
    const rollback = await setup.prepare?.();
    try {
      return await deps.runRegistration(async (scope) => {
        const repo = await scope.reposDBService.registerForProject(projectId, input);
        await setup.initialize?.(repo, scope);
        const link = await scope.reposDBService.getProjectRepoLink(projectId, repo.id);
        scope.eventBus.emit("repos", "set", repo);
        if (link) scope.eventBus.emit("project_repos", "set", link);
        return repo;
      });
    } catch (error) {
      await rollback?.();
      throw error;
    }
  };
  // The config ownership check and the database commit must agree on the same path owner.
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
