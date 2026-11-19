import type { createProjectsDBService } from "pstdio-db";
import type { EventBus } from "../features/sync/event-bus";
import { createProjectWork } from "./project-work";
import type { createSyncService } from "./sync-service";

export type ProjectServiceDeps = {
  projectsDBService: ReturnType<typeof createProjectsDBService>;
  syncService: Pick<ReturnType<typeof createSyncService>, "cascadeDeletes">;
  eventBus: EventBus;
  work?: ReturnType<typeof createProjectWork>;
};

export const createProjectService = (deps: ProjectServiceDeps) => {
  const db = deps.projectsDBService;
  const work = deps.work ?? createProjectWork();
  const get = async (id: string) => (!work.canRead(id) ? null : db.get(id));
  const publish = <T extends object | null>(project: T) => {
    if (project) deps.eventBus.emit("projects", "set", project);
    return project;
  };
  const create = async (
    input: Parameters<typeof db.create>[0],
    initialize?: (project: Awaited<ReturnType<typeof db.create>>) => Promise<void>,
  ) => {
    const id = input.id ?? crypto.randomUUID();
    return work.run(id, async (signal) => {
      // Hold explicit identities until initialization has either finished or rolled back.
      const project = await db.create({ ...input, id });
      try {
        await initialize?.(project);
        signal.throwIfAborted();
      } catch (error) {
        await deleteProject(project.id);
        throw error;
      }
      return publish(project);
    });
  };
  const update: typeof db.update = (id, value) => work.run(id, async () => publish(await db.update(id, value)));
  const setDefaults: typeof db.setDefaults = (id, value) =>
    work.run(id, async () => publish(await db.setDefaults(id, value)));
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
  return {
    query: (input?: Parameters<typeof db.query>[0]) => db.query(input, work.hiddenIds()),
    list: async () => (await db.list()).filter(({ id }) => !work.hidden(id)),
    get,
    create,
    update,
    setDefaults,
    delete: deleteProject,
    work,
  };
};
