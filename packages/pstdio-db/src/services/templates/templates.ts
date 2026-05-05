import { and, eq, inArray, isNotNull, isNull, ne } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { project_template_defaults, templates } from "../../db/schemas.pg";

type TemplateRow = typeof templates.$inferSelect;
type TemplateRecord = TemplateRow & { is_default: boolean };

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

const setProjectTemplateDefault = async (
  db: DbClient,
  projectId: string,
  templateType: string,
  templateId: string,
  timestamp: string,
) => {
  const existing = await db
    .select()
    .from(project_template_defaults)
    .where(
      and(
        eq(project_template_defaults.project_id, projectId),
        eq(project_template_defaults.template_type, templateType),
      ),
    );

  if (existing.length > 0) {
    await db
      .update(project_template_defaults)
      .set({
        source: "project_template",
        template_id: templateId,
        extension_instance_id: null,
        template_key: null,
        updated_at: timestamp,
      })
      .where(
        and(
          eq(project_template_defaults.project_id, projectId),
          eq(project_template_defaults.template_type, templateType),
        ),
      );
    return;
  }

  await db.insert(project_template_defaults).values({
    project_id: projectId,
    template_type: templateType,
    source: "project_template",
    template_id: templateId,
    extension_instance_id: null,
    template_key: null,
    updated_at: timestamp,
  });
};

const clearProjectTemplateDefaultIf = async (
  db: DbClient,
  projectId: string,
  templateType: string,
  templateId: string,
) => {
  await db
    .delete(project_template_defaults)
    .where(
      and(
        eq(project_template_defaults.project_id, projectId),
        eq(project_template_defaults.template_type, templateType),
        eq(project_template_defaults.source, "project_template"),
        eq(project_template_defaults.template_id, templateId),
      ),
    );
};

const decorateRows = async (db: DbClient, rows: TemplateRow[]) => {
  if (rows.length === 0) return [];

  const projectIds = Array.from(new Set(rows.map((r) => r.project_id).filter((id): id is string => id !== null)));
  if (projectIds.length === 0) {
    return rows.map((r) => ({ ...r, is_default: false }));
  }

  const defaults = await db
    .select()
    .from(project_template_defaults)
    .where(
      and(
        inArray(project_template_defaults.project_id, projectIds),
        eq(project_template_defaults.source, "project_template"),
      ),
    );

  const defaultIds = new Set(defaults.map((d) => d.template_id).filter((id): id is string => id !== null));
  return rows.map((r) => ({ ...r, is_default: defaultIds.has(r.id) }));
};

const decorateRow = async (db: DbClient, row: TemplateRow) => {
  const [decorated] = await decorateRows(db, [row]);
  return decorated;
};

export const createTemplatesDBService = (db: DbClient) => {
  const list = async (projectId: string) => {
    const rows = await db
      .select()
      .from(templates)
      .where(and(eq(templates.project_id, projectId), isNull(templates.deleted_at)))
      .orderBy(templates.name);
    return decorateRows(db, rows);
  };

  const getByName = async (projectId: string, name: string) => {
    const [row] = await db
      .select()
      .from(templates)
      .where(and(eq(templates.project_id, projectId), eq(templates.name, name), isNull(templates.deleted_at)));
    if (!row) return null;
    return decorateRow(db, row);
  };

  const create = async (input: CreateInput) => {
    const timestamp = nowTimestamp();
    const isDefault = input.is_default ?? false;

    const row: TemplateRow = {
      id: crypto.randomUUID(),
      project_id: input.project_id,
      name: input.name,
      template_type: input.template_type,
      file_id: input.file_id,
      created_at: timestamp,
      updated_at: timestamp,
      deleted_at: null,
    };

    await db.insert(templates).values(row);

    if (isDefault) {
      await setProjectTemplateDefault(db, input.project_id, input.template_type, row.id, timestamp);
    }

    return { ...row, is_default: isDefault };
  };

  const update = async (projectId: string, name: string, input: UpdateInput) => {
    const existingRow = await db
      .select()
      .from(templates)
      .where(and(eq(templates.project_id, projectId), eq(templates.name, name), isNull(templates.deleted_at)));

    const existing = existingRow[0];
    if (!existing) {
      return { error: "not_found" } as const satisfies UpdateResult;
    }

    const decoratedExisting = await decorateRow(db, existing);
    const nextTemplateType = input.template_type ?? existing.template_type;

    if (nextTemplateType !== existing.template_type && decoratedExisting.is_default) {
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
    const nextIsDefault = input.is_default ?? decoratedExisting.is_default;

    const updatedRow: TemplateRow = {
      ...existing,
      file_id: input.file_id ?? existing.file_id,
      template_type: nextTemplateType,
      updated_at: timestamp,
    };

    await db
      .update(templates)
      .set({
        file_id: updatedRow.file_id,
        template_type: updatedRow.template_type,
        updated_at: updatedRow.updated_at,
      })
      .where(eq(templates.id, existing.id));

    if (nextTemplateType !== existing.template_type && decoratedExisting.is_default) {
      await clearProjectTemplateDefaultIf(db, projectId, existing.template_type, existing.id);
    }

    if (nextIsDefault) {
      await setProjectTemplateDefault(db, projectId, nextTemplateType, existing.id, timestamp);
    } else if (decoratedExisting.is_default) {
      await clearProjectTemplateDefaultIf(db, projectId, nextTemplateType, existing.id);
    }

    return { template: { ...updatedRow, is_default: nextIsDefault } } as const satisfies UpdateResult;
  };

  const remove = async (projectId: string, name: string) => {
    const [existing] = await db
      .select()
      .from(templates)
      .where(and(eq(templates.project_id, projectId), eq(templates.name, name), isNull(templates.deleted_at)));
    if (!existing) return null;

    const deletedAt = nowTimestamp();
    await db.update(templates).set({ deleted_at: deletedAt }).where(eq(templates.id, existing.id));
    await clearProjectTemplateDefaultIf(db, projectId, existing.template_type, existing.id);
    return { ...existing, is_default: false, deleted_at: deletedAt };
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
