import { and, eq, isNull } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { projects, ticket_statuses, ticket_tags } from "../../db/schemas.pg";
import { deriveShorthand } from "./derive-shorthand";

type ProjectRecord = typeof projects.$inferSelect;

const DEFAULT_TICKET_STATUSES = [
  {
    name: "backlog",
    color: "gray",
    is_default: true,
    is_open: true,
    can_drag_out: true,
    can_drag_in: true,
    can_create: true,
    can_attempt_on_drop: false,
    column_actions: [],
  },
  {
    name: "ready",
    color: "teal",
    is_default: false,
    is_open: true,
    can_drag_out: true,
    can_drag_in: true,
    can_create: false,
    can_attempt_on_drop: false,
    column_actions: [],
  },
  {
    name: "wip",
    color: "blue",
    is_default: false,
    is_open: true,
    can_drag_out: false,
    can_drag_in: true,
    can_create: false,
    can_attempt_on_drop: true,
    column_actions: [],
  },
  {
    name: "blocked",
    color: "red",
    is_default: false,
    is_open: true,
    can_drag_out: true,
    can_drag_in: true,
    can_create: false,
    can_attempt_on_drop: false,
    column_actions: [],
  },
  {
    name: "review",
    color: "amber",
    is_default: false,
    is_open: true,
    can_drag_out: true,
    can_drag_in: true,
    can_create: false,
    can_attempt_on_drop: false,
    column_actions: [],
  },
  {
    name: "done",
    color: "green",
    is_default: false,
    is_open: false,
    can_drag_out: true,
    can_drag_in: true,
    can_create: false,
    can_attempt_on_drop: false,
    column_actions: ["archive_all"],
  },
] as const;

const DEFAULT_TICKET_TAGS = [
  { name: "bug", color: "red" },
  { name: "feature", color: "blue" },
  { name: "documentation", color: "purple" },
] as const;

const nowTimestamp = () => new Date().toISOString();

export const createProjectsService = (db: DbClient) => {
  const list = async () => db.select().from(projects).where(isNull(projects.deleted_at)).orderBy(projects.created_at);

  const get = async (id: string) => {
    const [project] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, id), isNull(projects.deleted_at)));
    return project ?? null;
  };

  const create = async (input: { name: string }) => {
    const timestamp = nowTimestamp();
    const project: ProjectRecord = {
      id: crypto.randomUUID(),
      name: input.name,
      shorthand: deriveShorthand(input.name),
      startup_script: null,
      created_at: timestamp,
      updated_at: timestamp,
      deleted_at: null,
    };

    await db.insert(projects).values(project);

    await db.insert(ticket_statuses).values(
      DEFAULT_TICKET_STATUSES.map((status, index) => ({
        id: crypto.randomUUID(),
        project_id: project.id,
        name: status.name,
        color: status.color,
        sort_order: index + 1,
        is_default: status.is_default,
        is_open: status.is_open,
        can_drag_out: status.can_drag_out,
        can_drag_in: status.can_drag_in,
        can_create: status.can_create,
        can_attempt_on_drop: status.can_attempt_on_drop,
        column_actions: JSON.stringify(status.column_actions),
        created_at: timestamp,
        updated_at: timestamp,
      })),
    );

    await db.insert(ticket_tags).values(
      DEFAULT_TICKET_TAGS.map((tag) => ({
        id: crypto.randomUUID(),
        project_id: project.id,
        name: tag.name,
        color: tag.color,
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

  return { list, get, create, update, remove, getStartupScript, setStartupScript, clearStartupScript };
};
