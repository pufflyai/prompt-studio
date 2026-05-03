import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { templates } from "../../db/schemas.pg";

type TemplateRecord = typeof templates.$inferSelect;

const nowTimestamp = () => new Date().toISOString();

export type UpsertExtensionTemplateRowInput = {
  project_id: string;
  extension_id: string;
  template_key: string;
  name: string;
  template_type: string;
};

export const createTemplateExtensionRowOps = (db: DbClient) => {
  const findExtensionRow = async (projectId: string, extensionId: string, templateKey: string) => {
    const [row] = await db
      .select()
      .from(templates)
      .where(
        and(
          eq(templates.project_id, projectId),
          eq(templates.extension_id, extensionId),
          eq(templates.template_key, templateKey),
        ),
      );
    return row ?? null;
  };

  const upsertExtensionRow = async (input: UpsertExtensionTemplateRowInput) => {
    const timestamp = nowTimestamp();
    const existing = await findExtensionRow(input.project_id, input.extension_id, input.template_key);

    if (existing) {
      const next: TemplateRecord = {
        ...existing,
        name: input.name,
        template_type: input.template_type,
        updated_at: timestamp,
        deleted_at: null,
      };
      await db
        .update(templates)
        .set({
          name: next.name,
          template_type: next.template_type,
          updated_at: next.updated_at,
          deleted_at: null,
        })
        .where(eq(templates.id, existing.id));
      return { record: next, created: false } as const;
    }

    const record: TemplateRecord = {
      id: crypto.randomUUID(),
      project_id: input.project_id,
      name: input.name,
      template_type: input.template_type,
      file_id: null,
      is_default: false,
      extension_id: input.extension_id,
      template_key: input.template_key,
      origin_extension_id: null,
      origin_template_key: null,
      created_at: timestamp,
      updated_at: timestamp,
      deleted_at: null,
    };
    await db.insert(templates).values(record);
    return { record, created: true } as const;
  };

  const listExtensionRows = async (projectId: string) =>
    db
      .select()
      .from(templates)
      .where(and(eq(templates.project_id, projectId), isNotNull(templates.extension_id), isNull(templates.deleted_at)));

  const removeExtensionRowsExcept = async (
    projectId: string,
    keep: { extension_id: string; template_key: string }[],
  ) => {
    const all = await listExtensionRows(projectId);
    const keepIds = new Set(keep.map((k) => `${k.extension_id}::${k.template_key}`));
    const orphanIds = all
      .filter((row) => !keepIds.has(`${row.extension_id}::${row.template_key}`))
      .map((row) => row.id);
    if (orphanIds.length === 0) return 0;
    await db.delete(templates).where(inArray(templates.id, orphanIds));
    return orphanIds.length;
  };

  const removeAllExtensionRows = async (projectId: string) => {
    const result = await db
      .delete(templates)
      .where(and(eq(templates.project_id, projectId), isNotNull(templates.extension_id)))
      .returning({ id: templates.id });
    return result.length;
  };

  return {
    findExtensionRow,
    upsertExtensionRow,
    listExtensionRows,
    removeExtensionRowsExcept,
    removeAllExtensionRows,
  };
};
