import { and, asc, eq, gt, isNull, notInArray } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { project_extensions, projects, storage_record_indexes } from "../../db/schemas.pg";
import { projectExtensionRow } from "../extension-instances/project-extension-row";
import { dropRecordIndexes } from "../extension-storage/record-index-lifecycle";
import { type PageQuery, pageBoundary, pageLimit, queryPage } from "../query-page";
import { deriveShorthand } from "./derive-shorthand";

type ProjectRecord = typeof projects.$inferSelect;

const nowTimestamp = () => new Date().toISOString();

export const createProjectsDBService = (db: DbClient) => {
  const list = async () => db.select().from(projects).where(isNull(projects.deleted_at)).orderBy(projects.created_at);

  const query = async (input: PageQuery = {}, excludedIds: string[] = []) => {
    const limit = pageLimit(input);
    const boundary = pageBoundary(input.cursor, "projects");
    const rows = await db
      .select()
      .from(projects)
      .where(
        and(
          isNull(projects.deleted_at),
          boundary ? gt(projects.id, boundary) : undefined,
          excludedIds.length ? notInArray(projects.id, excludedIds) : undefined,
        ),
      )
      .orderBy(asc(projects.id))
      .limit(limit + 1);
    return queryPage(rows, limit, "projects");
  };

  const get = async (id: string) => {
    const [project] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, id), isNull(projects.deleted_at)));
    return project ?? null;
  };

  const create = async (input: { id?: string; name: string }) => {
    const timestamp = nowTimestamp();
    const project: ProjectRecord = {
      id: input.id ?? crypto.randomUUID(),
      name: input.name,
      shorthand: deriveShorthand(input.name),
      default_agent_id: null,
      default_agent_model: null,
      startup_script: null,
      created_at: timestamp,
      updated_at: timestamp,
      deleted_at: null,
    };

    await db.insert(projects).values(project);

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

  const setDefaults = async (
    id: string,
    input: { default_agent_id?: string | null; default_agent_model?: string | null },
  ) => {
    const existing = await get(id);
    if (!existing) return null;

    const next = {
      default_agent_id: input.default_agent_id === undefined ? existing.default_agent_id : input.default_agent_id,
      default_agent_model:
        input.default_agent_model === undefined ? existing.default_agent_model : input.default_agent_model,
      updated_at: nowTimestamp(),
    };

    await db.update(projects).set(next).where(eq(projects.id, id));

    return { ...existing, ...next } satisfies ProjectRecord;
  };

  const remove = async (id: string) => {
    const existing = await get(id);

    if (!existing) return false;

    await db.update(projects).set({ deleted_at: nowTimestamp() }).where(eq(projects.id, id));

    return true;
  };

  // Capture rows for committed sync deletions before the project FK cascades them.
  const hardDelete = async (id: string) =>
    db.transaction(async (tx) => {
      await dropRecordIndexes(tx, eq(storage_record_indexes.workbench_id, id));
      const extensionInstances = await tx
        .select()
        .from(project_extensions)
        .where(eq(project_extensions.project_id, id));
      const [deleted] = await tx.delete(projects).where(eq(projects.id, id)).returning({ id: projects.id });
      if (!deleted) return null;
      return { extensionInstances: extensionInstances.map(projectExtensionRow) };
    });

  return {
    list,
    query,
    get,
    create,
    update,
    setDefaults,
    remove,
    hardDelete,
  };
};
