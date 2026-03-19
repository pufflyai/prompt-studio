import { and, eq, isNotNull, isNull, ne } from "drizzle-orm";
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
  template_type?: string;
};

type UpdateResult = { template: TemplateRecord } | { error: "not_found" | "cannot_change_only_default_template_type" };

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
    if (!existing) {
      return { error: "not_found" } as const satisfies UpdateResult;
    }

    const nextTemplateType = input.template_type ?? existing.template_type;
    if (nextTemplateType !== existing.template_type && existing.is_default) {
      const [otherTemplateInSourceType] = await db
        .select({ id: templates.id })
        .from(templates)
        .where(
          and(
            eq(templates.project_id, projectId),
            eq(templates.template_type, existing.template_type),
            isNull(templates.deleted_at),
            ne(templates.id, existing.id),
          ),
        );

      if (!otherTemplateInSourceType) {
        return { error: "cannot_change_only_default_template_type" } as const satisfies UpdateResult;
      }
    }

    const timestamp = nowTimestamp();
    const nextIsDefault = input.is_default ?? existing.is_default;

    if (nextIsDefault) {
      await db
        .update(templates)
        .set({ is_default: false, updated_at: timestamp })
        .where(
          and(
            eq(templates.project_id, projectId),
            eq(templates.template_type, nextTemplateType),
            eq(templates.is_default, true),
            isNull(templates.deleted_at),
            ne(templates.id, existing.id),
          ),
        );
    }

    const updated: TemplateRecord = {
      ...existing,
      file_id: input.file_id ?? existing.file_id,
      is_default: nextIsDefault,
      template_type: nextTemplateType,
      updated_at: timestamp,
    };

    await db
      .update(templates)
      .set({
        file_id: updated.file_id,
        is_default: updated.is_default,
        template_type: updated.template_type,
        updated_at: updated.updated_at,
      })
      .where(eq(templates.id, existing.id));

    return { template: updated } as const satisfies UpdateResult;
  };

  const remove = async (projectId: string, name: string) => {
    const existing = await getByName(projectId, name);
    if (!existing) return null;

    const deletedAt = nowTimestamp();
    await db.update(templates).set({ deleted_at: deletedAt }).where(eq(templates.id, existing.id));
    return { ...existing, deleted_at: deletedAt };
  };

  const hardRemove = async (projectId: string, name: string) => {
    const deleted = await db
      .delete(templates)
      .where(and(eq(templates.project_id, projectId), eq(templates.name, name), isNotNull(templates.deleted_at)))
      .returning({ id: templates.id });
    return deleted.length > 0;
  };

  return { list, getByName, create, update, remove, hardRemove };
};
