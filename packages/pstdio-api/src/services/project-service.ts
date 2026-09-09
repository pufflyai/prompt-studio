import type { createProjectsDBService } from "pstdio-db";
import type { EventBus } from "../features/sync/event-bus";

export type ProjectServiceDeps = {
  projectsDBService: ReturnType<typeof createProjectsDBService>;
  eventBus: EventBus;
};

export const createProjectService = (deps: ProjectServiceDeps) => {
  const db = deps.projectsDBService;
  const create = async (
    input: Parameters<typeof db.create>[0],
    initialize?: (project: Awaited<ReturnType<typeof db.create>>) => Promise<void>,
  ) => {
    const project = await db.create(input);
    try {
      await initialize?.(project);
    } catch (error) {
      await db.hardDelete(project.id);
      throw error;
    }
    deps.eventBus.emit("projects", "set", project);
    return project;
  };
  const update = async (...args: Parameters<typeof db.update>) => {
    const project = await db.update(...args);
    if (project) deps.eventBus.emit("projects", "set", project);
    return project;
  };
  return { ...db, create, update };
};
