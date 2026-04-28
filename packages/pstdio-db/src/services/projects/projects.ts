import { and, eq, isNull } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { attempt_statuses, projects } from "../../db/schemas.pg";
import { deriveShorthand } from "./derive-shorthand";

type ProjectRecord = typeof projects.$inferSelect;

const DEFAULT_ATTEMPT_STATUSES = [
  { name: "wip", color: "blue", is_default: true },
  { name: "blocked", color: "red", is_default: false },
  { name: "review-ready", color: "amber", is_default: false },
  { name: "reviewed", color: "green", is_default: false },
  { name: "changes-requested", color: "orange", is_default: false },
] as const;

const nowTimestamp = () => new Date().toISOString();

export const createProjectsDBService = (db: DbClient) => {
  const list = async () => db.select().from(projects).where(isNull(projects.deleted_at)).orderBy(projects.created_at);

  const get = async (id: string) => {
    const [project] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, id), isNull(projects.deleted_at)));
    return project ?? null;
  };

  const create = async (input: { name: string; selectedAgents?: string[] }) => {
    const timestamp = nowTimestamp();
    const project: ProjectRecord = {
      id: crypto.randomUUID(),
      name: input.name,
      shorthand: deriveShorthand(input.name),
      selected_agents: JSON.stringify(input.selectedAgents ?? []),
      startup_script: null,
      created_at: timestamp,
      updated_at: timestamp,
      deleted_at: null,
    };

    await db.insert(projects).values(project);

    await db.insert(attempt_statuses).values(
      DEFAULT_ATTEMPT_STATUSES.map((status, index) => ({
        id: crypto.randomUUID(),
        project_id: project.id,
        name: status.name,
        color: status.color,
        sort_order: index + 1,
        is_default: status.is_default,
        created_at: timestamp,
        updated_at: timestamp,
      })),
    );

    return project;
  };

  const update = async (id: string, input: { name: string }) => {
    const existing = await get(id);

    if (!existing) return null;

    const updated: ProjectRecord = {
      ...existing,
      name: input.name,
      updated_at: nowTimestamp(),
    };

    await db.update(projects).set({ name: updated.name, updated_at: updated.updated_at }).where(eq(projects.id, id));

    return updated;
  };

  const remove = async (id: string) => {
    const existing = await get(id);

    if (!existing) return false;

    await db.update(projects).set({ deleted_at: nowTimestamp() }).where(eq(projects.id, id));

    return true;
  };

  const hardDelete = async (id: string) => {
    const [existing] = await db.select().from(projects).where(eq(projects.id, id));

    if (!existing) return false;

    await db.delete(projects).where(eq(projects.id, id));

    return true;
  };

  const getStartupScript = async (id: string) => {
    const project = await get(id);
    if (!project) return null;
    return project.startup_script;
  };

  const setStartupScript = async (id: string, script: string) => {
    const existing = await get(id);
    if (!existing) return null;

    await db.update(projects).set({ startup_script: script, updated_at: nowTimestamp() }).where(eq(projects.id, id));

    return true;
  };

  const clearStartupScript = async (id: string) => {
    const existing = await get(id);
    if (!existing) return null;

    await db.update(projects).set({ startup_script: null, updated_at: nowTimestamp() }).where(eq(projects.id, id));

    return true;
  };

  return { list, get, create, update, remove, hardDelete, getStartupScript, setStartupScript, clearStartupScript };
};
