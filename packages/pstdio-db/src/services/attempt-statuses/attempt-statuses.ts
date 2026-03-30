import { and, eq, isNull, sql } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { attempt_statuses } from "../../db/schemas.pg";

type CreateInput = {
  project_id: string;
  name: string;
  color: string;
  is_default?: boolean;
};

const nowTimestamp = () => new Date().toISOString();

export const createAttemptStatusesDBService = (db: DbClient) => {
  const list = async (projectId: string) =>
    db
      .select()
      .from(attempt_statuses)
      .where(and(eq(attempt_statuses.project_id, projectId), isNull(attempt_statuses.deleted_at)))
      .orderBy(attempt_statuses.sort_order);

  const get = async (id: string) => {
    const [row] = await db
      .select()
      .from(attempt_statuses)
      .where(and(eq(attempt_statuses.id, id), isNull(attempt_statuses.deleted_at)));
    return row ?? null;
  };

  const getByName = async (projectId: string, name: string) => {
    const [row] = await db
      .select()
      .from(attempt_statuses)
      .where(
        and(
          eq(attempt_statuses.project_id, projectId),
          eq(attempt_statuses.name, name),
          isNull(attempt_statuses.deleted_at),
        ),
      );
    return row ?? null;
  };

  const create = async (input: CreateInput) => {
    const [maxRow] = await db
      .select({ max: sql<number>`coalesce(max(${attempt_statuses.sort_order}), 0)` })
      .from(attempt_statuses)
      .where(and(eq(attempt_statuses.project_id, input.project_id), isNull(attempt_statuses.deleted_at)));

    const timestamp = nowTimestamp();

    if (input.is_default) {
      await db
        .update(attempt_statuses)
        .set({ is_default: false, updated_at: timestamp })
        .where(and(eq(attempt_statuses.project_id, input.project_id), eq(attempt_statuses.is_default, true)));
    }

    const record = {
      id: crypto.randomUUID(),
      project_id: input.project_id,
      name: input.name,
      color: input.color,
      sort_order: maxRow.max + 1,
      is_default: input.is_default ?? false,
      created_at: timestamp,
      updated_at: timestamp,
      deleted_at: null,
    };

    await db.insert(attempt_statuses).values(record);
    return record;
  };

  const update = async (
    id: string,
    input: { name?: string; color?: string; sort_order?: number; is_default?: boolean },
  ) => {
    const timestamp = nowTimestamp();

    if (input.is_default) {
      const row = await get(id);
      if (row) {
        await db
          .update(attempt_statuses)
          .set({ is_default: false, updated_at: timestamp })
          .where(and(eq(attempt_statuses.project_id, row.project_id), eq(attempt_statuses.is_default, true)));
      }
    }

    const next: Record<string, unknown> = { updated_at: timestamp };
    if (input.name !== undefined) next.name = input.name;
    if (input.color !== undefined) next.color = input.color;
    if (input.sort_order !== undefined) next.sort_order = input.sort_order;
    if (input.is_default !== undefined) next.is_default = input.is_default;

    const [updated] = await db.update(attempt_statuses).set(next).where(eq(attempt_statuses.id, id)).returning();
    return updated;
  };

  const remove = async (id: string) => {
    await db.delete(attempt_statuses).where(eq(attempt_statuses.id, id));
  };

  return { list, get, getByName, create, update, remove };
};
