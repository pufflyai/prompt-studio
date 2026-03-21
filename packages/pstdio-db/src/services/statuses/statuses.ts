import { and, eq, isNull, sql } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { ticket_statuses } from "../../db/schemas.pg";

type CreateInput = {
  project_id: string;
  name: string;
  color: string;
  is_default?: boolean;
};

const nowTimestamp = () => new Date().toISOString();

export const createStatusesService = (db: DbClient) => {
  const list = async (projectId: string) =>
    db
      .select()
      .from(ticket_statuses)
      .where(and(eq(ticket_statuses.project_id, projectId), isNull(ticket_statuses.deleted_at)))
      .orderBy(ticket_statuses.sort_order);

  const getByName = async (projectId: string, name: string) => {
    const [row] = await db
      .select()
      .from(ticket_statuses)
      .where(
        and(
          eq(ticket_statuses.project_id, projectId),
          eq(ticket_statuses.name, name),
          isNull(ticket_statuses.deleted_at),
        ),
      );
    return row ?? null;
  };

  const create = async (input: CreateInput) => {
    const [maxRow] = await db
      .select({ max: sql<number>`coalesce(max(${ticket_statuses.sort_order}), 0)` })
      .from(ticket_statuses)
      .where(and(eq(ticket_statuses.project_id, input.project_id), isNull(ticket_statuses.deleted_at)));

    const timestamp = nowTimestamp();

    if (input.is_default) {
      await db
        .update(ticket_statuses)
        .set({ is_default: false, updated_at: timestamp })
        .where(and(eq(ticket_statuses.project_id, input.project_id), eq(ticket_statuses.is_default, true)));
    }

    const record = {
      id: crypto.randomUUID(),
      project_id: input.project_id,
      name: input.name,
      color: input.color,
      sort_order: maxRow.max + 1,
      is_default: input.is_default ?? false,
      is_open: true,
      can_drag_out: true,
      can_drag_in: true,
      can_create: false,
      column_actions: "[]",
      created_at: timestamp,
      updated_at: timestamp,
      deleted_at: null,
    };

    await db.insert(ticket_statuses).values(record);
    return record;
  };

  const getDefault = async (projectId: string) => {
    const [row] = await db
      .select()
      .from(ticket_statuses)
      .where(
        and(
          eq(ticket_statuses.project_id, projectId),
          eq(ticket_statuses.is_default, true),
          isNull(ticket_statuses.deleted_at),
        ),
      );
    return row ?? null;
  };

  const setDefault = async (projectId: string, statusId: string) => {
    const timestamp = nowTimestamp();

    await db
      .update(ticket_statuses)
      .set({ is_default: false, updated_at: timestamp })
      .where(and(eq(ticket_statuses.project_id, projectId), eq(ticket_statuses.is_default, true)));

    await db
      .update(ticket_statuses)
      .set({ is_default: true, updated_at: timestamp })
      .where(eq(ticket_statuses.id, statusId));
  };

  const updateColor = async (id: string, color: string) => {
    await db.update(ticket_statuses).set({ color, updated_at: nowTimestamp() }).where(eq(ticket_statuses.id, id));
  };

  const softDelete = async (id: string) => {
    await db.update(ticket_statuses).set({ deleted_at: nowTimestamp() }).where(eq(ticket_statuses.id, id));
  };

  return { list, getByName, getDefault, create, setDefault, updateColor, softDelete };
};
