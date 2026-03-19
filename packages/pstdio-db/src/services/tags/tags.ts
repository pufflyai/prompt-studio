import { and, eq, isNull } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { ticket_tags } from "../../db/schemas.pg";

type CreateInput = {
  project_id: string;
  name: string;
  color: string;
};

const nowTimestamp = () => new Date().toISOString();

export const createTagsService = (db: DbClient) => {
  const list = async (projectId: string) =>
    db
      .select()
      .from(ticket_tags)
      .where(and(eq(ticket_tags.project_id, projectId), isNull(ticket_tags.deleted_at)))
      .orderBy(ticket_tags.name);

  const getByName = async (projectId: string, name: string) => {
    const [row] = await db
      .select()
      .from(ticket_tags)
      .where(and(eq(ticket_tags.project_id, projectId), eq(ticket_tags.name, name), isNull(ticket_tags.deleted_at)));
    return row ?? null;
  };

  const create = async (input: CreateInput) => {
    const timestamp = nowTimestamp();

    const record = {
      id: crypto.randomUUID(),
      project_id: input.project_id,
      name: input.name,
      color: input.color,
      created_at: timestamp,
      updated_at: timestamp,
      deleted_at: null,
    };

    await db.insert(ticket_tags).values(record);
    return record;
  };

  const update = async (id: string, input: { name: string; color: string }) => {
    await db
      .update(ticket_tags)
      .set({ name: input.name, color: input.color, updated_at: nowTimestamp() })
      .where(eq(ticket_tags.id, id));
  };

  const softDelete = async (id: string) => {
    await db.update(ticket_tags).set({ deleted_at: nowTimestamp() }).where(eq(ticket_tags.id, id));
  };

  return { list, getByName, create, update, softDelete };
};
