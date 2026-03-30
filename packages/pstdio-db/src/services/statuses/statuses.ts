import { and, eq, isNull, sql } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { ticket_statuses } from "../../db/schemas.pg";

type CreateInput = {
  project_id: string;
  name: string;
  color: string;
  is_default?: boolean;
};

type UpdateInput = {
  name?: string;
  color?: string;
  sort_order?: number;
  can_create?: boolean;
  can_drag_in?: boolean;
  can_drag_out?: boolean;
  can_attempt_on_drop?: boolean;
  column_actions?: string[];
};

const nowTimestamp = () => new Date().toISOString();

export const createStatusesDBService = (db: DbClient) => {
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

  const update = async (id: string, input: UpdateInput) => {
    const next: Record<string, unknown> = { updated_at: nowTimestamp() };
    if (input.name !== undefined) next.name = input.name;
    if (input.color !== undefined) next.color = input.color;
    if (input.sort_order !== undefined) next.sort_order = input.sort_order;
    if (input.can_create !== undefined) next.can_create = input.can_create;
    if (input.can_drag_in !== undefined) next.can_drag_in = input.can_drag_in;
    if (input.can_drag_out !== undefined) next.can_drag_out = input.can_drag_out;
    if (input.can_attempt_on_drop !== undefined) next.can_attempt_on_drop = input.can_attempt_on_drop;
    if (input.column_actions !== undefined) next.column_actions = JSON.stringify(input.column_actions);

    await db.update(ticket_statuses).set(next).where(eq(ticket_statuses.id, id));
  };

  const remove = async (id: string) => {
    await db.delete(ticket_statuses).where(eq(ticket_statuses.id, id));
  };

  return { list, getByName, getDefault, create, setDefault, updateColor, update, remove };
};
