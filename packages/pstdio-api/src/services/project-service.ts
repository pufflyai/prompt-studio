import type { createProjectsDBService } from "pstdio-db";
import type { EventBus } from "../features/sync/event-bus";
import type { createSyncService } from "./sync-service";

export type ProjectServiceDeps = {
  projectsDBService: ReturnType<typeof createProjectsDBService>;
  syncService: Pick<ReturnType<typeof createSyncService>, "cascadeDeletes">;
  eventBus: EventBus;
};

export const createProjectService = (deps: ProjectServiceDeps) => {
  const db = deps.projectsDBService;
  const publish = <T extends object | null>(project: T) => {
    if (project) deps.eventBus.emit("projects", "set", project);
    return project;
  };
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
    return publish(project);
  };
  const update = async (...args: Parameters<typeof db.update>) => publish(await db.update(...args));
  const setDefaults = async (...args: Parameters<typeof db.setDefaults>) => publish(await db.setDefaults(...args));
  // Clients drop cascaded rows only after the database has removed them. Rows that point at
  // an extension instance go first, and the project goes last.
  const deleteProject = async (id: string) => {
    const cascaded = await deps.syncService.cascadeDeletes("projects", id);
    const removed = await db.hardDelete(id);
    if (!removed) return false;
    const project = cascaded.pop();
    for (const row of cascaded) deps.eventBus.emit(row.table, "delete", { id: row.id });
    // Listeners read the instance scope to find the affected project, so send the full row.
    for (const instance of removed.extensionInstances) deps.eventBus.emit("extension_instances", "delete", instance);
    if (project) deps.eventBus.emit(project.table, "delete", { id: project.id });
    return true;
  };
  return { list: db.list, get: db.get, create, update, setDefaults, delete: deleteProject };
};
