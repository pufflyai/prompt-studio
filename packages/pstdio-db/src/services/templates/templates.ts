import { and, eq, isNull } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { templates } from "../../db/schemas.pg";

type TemplateRecord = typeof templates.$inferSelect;

const nowTimestamp = () => new Date().toISOString();

type CreateInput = {
  project_id: string;
  name: string;
  template_type: string;
  file_id: string;
  is_default?: boolean;
};

type UpdateInput = {
  file_id?: string;
  is_default?: boolean;
};

export const createTemplatesService = (db: DbClient) => {
  const list = async (projectId: string) =>
    db
      .select()
      .from(templates)
      .where(and(eq(templates.project_id, projectId), isNull(templates.deleted_at)))
      .orderBy(templates.name);

  const getByName = async (projectId: string, name: string) => {
    const [template] = await db
      .select()
      .from(templates)
      .where(and(eq(templates.project_id, projectId), eq(templates.name, name), isNull(templates.deleted_at)));
    return template ?? null;
  };

  const create = async (input: CreateInput) => {
    const timestamp = nowTimestamp();
    const isDefault = input.is_default ?? false;

    if (isDefault) {
      await db
        .update(templates)
        .set({ is_default: false, updated_at: timestamp })
        .where(
          and(
            eq(templates.project_id, input.project_id),
            eq(templates.template_type, input.template_type),
            eq(templates.is_default, true),
            isNull(templates.deleted_at),
          ),
        );
    }

    const record: TemplateRecord = {
      id: crypto.randomUUID(),
      project_id: input.project_id,
      name: input.name,
      template_type: input.template_type,
      file_id: input.file_id,
      is_default: isDefault,
      created_at: timestamp,
      updated_at: timestamp,
      deleted_at: null,
    };

    await db.insert(templates).values(record);
    return record;
  };

  const update = async (projectId: string, name: string, input: UpdateInput) => {
    const existing = await getByName(projectId, name);
    if (!existing) return null;

    const timestamp = nowTimestamp();

    if (input.is_default) {
      await db
        .update(templates)
        .set({ is_default: false, updated_at: timestamp })
        .where(
          and(
            eq(templates.project_id, projectId),
            eq(templates.template_type, existing.template_type),
            eq(templates.is_default, true),
            isNull(templates.deleted_at),
          ),
        );
    }

    const updated: TemplateRecord = {
      ...existing,
      file_id: input.file_id ?? existing.file_id,
      is_default: input.is_default ?? existing.is_default,
      updated_at: timestamp,
    };

    await db
      .update(templates)
      .set({ file_id: updated.file_id, is_default: updated.is_default, updated_at: updated.updated_at })
      .where(eq(templates.id, existing.id));

    return updated;
  };

  const remove = async (projectId: string, name: string) => {
    const existing = await getByName(projectId, name);
    if (!existing) return false;

    await db.update(templates).set({ deleted_at: nowTimestamp() }).where(eq(templates.id, existing.id));
    return true;
  };

  return { list, getByName, create, update, remove };
};
