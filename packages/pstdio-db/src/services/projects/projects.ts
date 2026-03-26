import { and, eq, isNull } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { projects, ticket_statuses, ticket_tag_options, ticket_tags } from "../../db/schemas.pg";
import { deriveShorthand } from "./derive-shorthand";

type ProjectRecord = typeof projects.$inferSelect;

const DEFAULT_TICKET_STATUSES = [
  {
    name: "backlog",
    color: "gray",
    is_default: true,
    can_drag_out: true,
    can_drag_in: true,
    can_create: true,
    column_actions: [],
  },
  {
    name: "ready",
    color: "green",
    is_default: false,
    can_drag_out: true,
    can_drag_in: true,
    can_create: false,
    column_actions: [],
  },
  {
    name: "wip",
    color: "blue",
    is_default: false,
    can_drag_out: true,
    can_drag_in: true,
    can_create: false,
    column_actions: [],
  },
  {
    name: "blocked",
    color: "red",
    is_default: false,
    can_drag_out: true,
    can_drag_in: true,
    can_create: false,
    column_actions: [],
  },
  {
    name: "review",
    color: "amber",
    is_default: false,
    can_drag_out: true,
    can_drag_in: true,
    can_create: false,
    column_actions: [],
  },
  {
    name: "done",
    color: "green",
    is_default: false,
    can_drag_out: true,
    can_drag_in: true,
    can_create: false,
    column_actions: ["archive_all"],
  },
] as const;

const DEFAULT_TAG_DEFINITIONS = [
  {
    name: "label",
    type: "single_select" as const,
    options: [
      { name: "bug", color: "red", sort_order: 1, icon: "bug" },
      { name: "feature", color: "blue", sort_order: 2, icon: "sparkles" },
      { name: "documentation", color: "purple", sort_order: 3, icon: "book-open" },
      { name: "chore", color: "gray", sort_order: 4, icon: "wrench" },
    ],
  },
  {
    name: "complexity",
    type: "single_select" as const,
    options: [
      { name: "low", color: "green", sort_order: 1, icon: "gauge" },
      { name: "medium", color: "orange", sort_order: 2, icon: "gauge" },
      { name: "high", color: "red", sort_order: 3, icon: "gauge" },
    ],
  },
  {
    name: "priority",
    type: "single_select" as const,
    options: [
      { name: "P1", color: "red", sort_order: 1, icon: "alert-triangle" },
      { name: "P2", color: "orange", sort_order: 2, icon: "alert-triangle" },
      { name: "P3", color: "yellow", sort_order: 3, icon: "alert-triangle" },
    ],
  },
];

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
        can_drag_out: status.can_drag_out,
        can_drag_in: status.can_drag_in,
        can_create: status.can_create,
        column_actions: JSON.stringify(status.column_actions),
        created_at: timestamp,
        updated_at: timestamp,
      })),
    );

    for (const def of DEFAULT_TAG_DEFINITIONS) {
      const tagId = crypto.randomUUID();
      await db.insert(ticket_tags).values({
        id: tagId,
        project_id: project.id,
        name: def.name,
        type: def.type,
        created_at: timestamp,
        updated_at: timestamp,
      });
      await db.insert(ticket_tag_options).values(
        def.options.map((opt) => ({
          id: crypto.randomUUID(),
          tag_id: tagId,
          name: opt.name,
          color: opt.color,
          icon: "icon" in opt ? opt.icon : null,
          sort_order: opt.sort_order,
          created_at: timestamp,
          updated_at: timestamp,
        })),
      );
    }

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
