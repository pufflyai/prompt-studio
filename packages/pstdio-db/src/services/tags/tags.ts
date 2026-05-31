import { and, eq, isNull } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { ticket_tag_options, ticket_tags } from "../../db/schemas.pg";

type CreateTagInput = {
  project_id: string;
  name: string;
  type: "single_select" | "multi_select";
};

type CreateOptionInput = {
  tag_id: string;
  name: string;
  color: string;
  icon?: string;
  description?: string;
};

const nowTimestamp = () => new Date().toISOString();

/** @deprecated Legacy core ticket tag DB service. Ticket tags are owned by the pstdio tickets extension. */
export const createTagsDBService = (db: DbClient) => {
  const list = async (projectId: string) =>
    db
      .select()
      .from(ticket_tags)
      .where(and(eq(ticket_tags.project_id, projectId), isNull(ticket_tags.deleted_at)))
      .orderBy(ticket_tags.name);

  const listWithOptions = async (projectId: string) => {
    const tags = await list(projectId);
    const result = [];
    for (const tag of tags) {
      const options = await listOptions(tag.id);
      result.push({ ...tag, options });
    }
    return result;
  };

  const getByName = async (projectId: string, name: string) => {
    const [row] = await db
      .select()
      .from(ticket_tags)
      .where(and(eq(ticket_tags.project_id, projectId), eq(ticket_tags.name, name), isNull(ticket_tags.deleted_at)));
    return row ?? null;
  };

  const create = async (input: CreateTagInput) => {
    const timestamp = nowTimestamp();
    const record = {
      id: crypto.randomUUID(),
      project_id: input.project_id,
      name: input.name,
      type: input.type,
      created_at: timestamp,
      updated_at: timestamp,
      deleted_at: null,
    };
    await db.insert(ticket_tags).values(record);
    return record;
  };

  const update = async (id: string, input: { name?: string; type?: string }) => {
    await db
      .update(ticket_tags)
      .set({ ...input, updated_at: nowTimestamp() })
      .where(eq(ticket_tags.id, id));
  };

  const remove = async (id: string) => {
    await db.delete(ticket_tags).where(eq(ticket_tags.id, id));
  };

  // --- Options ---

  const listOptions = async (tagId: string) =>
    db
      .select()
      .from(ticket_tag_options)
      .where(and(eq(ticket_tag_options.tag_id, tagId), isNull(ticket_tag_options.deleted_at)))
      .orderBy(ticket_tag_options.sort_order);

  const createOption = async (input: CreateOptionInput) => {
    const existing = await listOptions(input.tag_id);
    const nextOrder = existing.length > 0 ? Math.max(...existing.map((o) => o.sort_order)) + 1 : 1;
    const timestamp = nowTimestamp();
    const record = {
      id: crypto.randomUUID(),
      tag_id: input.tag_id,
      name: input.name,
      color: input.color,
      icon: input.icon ?? null,
      description: input.description ?? null,
      sort_order: nextOrder,
      created_at: timestamp,
      updated_at: timestamp,
      deleted_at: null,
    };
    await db.insert(ticket_tag_options).values(record);
    return record;
  };

  const updateOption = async (
    id: string,
    input: { name?: string; color?: string; sort_order?: number; icon?: string | null; description?: string | null },
  ) => {
    await db
      .update(ticket_tag_options)
      .set({ ...input, updated_at: nowTimestamp() })
      .where(eq(ticket_tag_options.id, id));
  };

  const removeOption = async (id: string) => {
    await db.delete(ticket_tag_options).where(eq(ticket_tag_options.id, id));
  };

  return {
    list,
    listWithOptions,
    getByName,
    create,
    update,
    remove,
    listOptions,
    createOption,
    updateOption,
    removeOption,
  };
};
