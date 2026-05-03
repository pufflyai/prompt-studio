import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { skills } from "../../db/schemas.pg";

type SkillRow = typeof skills.$inferSelect;

const nowTimestamp = () => new Date().toISOString();

export type UpsertExtensionSkillRowInput = {
  project_id: string;
  extension_id: string;
  skill_key: string;
  name: string;
  description: string;
  files: { path: string; content: string; encoding: "utf8" }[];
};

export const createSkillExtensionRowOps = (db: DbClient) => {
  const findExtensionRow = async (projectId: string, extensionId: string, skillKey: string) => {
    const [row] = await db
      .select()
      .from(skills)
      .where(
        and(eq(skills.project_id, projectId), eq(skills.extension_id, extensionId), eq(skills.skill_key, skillKey)),
      );
    return row ?? null;
  };

  const upsertExtensionRow = async (input: UpsertExtensionSkillRowInput) => {
    const timestamp = nowTimestamp();
    const filesJson = JSON.stringify(input.files);
    const existing = await findExtensionRow(input.project_id, input.extension_id, input.skill_key);

    if (existing) {
      await db
        .update(skills)
        .set({
          name: input.name,
          description: input.description,
          files_json: filesJson,
          updated_at: timestamp,
          deleted_at: null,
        })
        .where(eq(skills.id, existing.id));
      return { id: existing.id, created: false } as const;
    }

    const row: SkillRow = {
      id: crypto.randomUUID(),
      project_id: input.project_id,
      name: input.name,
      description: input.description,
      file_id: null,
      files_json: filesJson,
      extension_id: input.extension_id,
      skill_key: input.skill_key,
      origin_extension_id: null,
      origin_skill_key: null,
      created_at: timestamp,
      updated_at: timestamp,
      deleted_at: null,
    };
    await db.insert(skills).values(row);
    return { id: row.id, created: true } as const;
  };

  const listExtensionRows = async (projectId: string) =>
    db
      .select()
      .from(skills)
      .where(and(eq(skills.project_id, projectId), isNotNull(skills.extension_id), isNull(skills.deleted_at)));

  const removeExtensionRowsExcept = async (projectId: string, keep: { extension_id: string; skill_key: string }[]) => {
    const all = await listExtensionRows(projectId);
    const keepIds = new Set(keep.map((k) => `${k.extension_id}::${k.skill_key}`));
    const orphanIds = all.filter((row) => !keepIds.has(`${row.extension_id}::${row.skill_key}`)).map((row) => row.id);
    if (orphanIds.length === 0) return 0;
    await db.delete(skills).where(inArray(skills.id, orphanIds));
    return orphanIds.length;
  };

  const removeAllExtensionRows = async (projectId: string) => {
    const result = await db
      .delete(skills)
      .where(and(eq(skills.project_id, projectId), isNotNull(skills.extension_id)))
      .returning({ id: skills.id });
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
