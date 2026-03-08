import { and, eq, isNull } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { skills } from "../../db/schemas.pg";

type SkillRecord = typeof skills.$inferSelect;

const nowTimestamp = () => new Date().toISOString();

type CreateInput = {
  project_id: string;
  name: string;
  description: string;
  file_id: string;
};

type UpdateInput = {
  file_id?: string;
  description?: string;
};

export const createSkillsDbService = (db: DbClient) => {
  const list = async (projectId: string) =>
    db
      .select()
      .from(skills)
      .where(and(eq(skills.project_id, projectId), isNull(skills.deleted_at)))
      .orderBy(skills.name);

  const getByName = async (projectId: string, name: string) => {
    const [skill] = await db
      .select()
      .from(skills)
      .where(and(eq(skills.project_id, projectId), eq(skills.name, name), isNull(skills.deleted_at)));
    return skill ?? null;
  };

  const create = async (input: CreateInput) => {
    const timestamp = nowTimestamp();

    const record: SkillRecord = {
      id: crypto.randomUUID(),
      project_id: input.project_id,
      name: input.name,
      description: input.description,
      file_id: input.file_id,
      created_at: timestamp,
      updated_at: timestamp,
      deleted_at: null,
    };

    await db.insert(skills).values(record);
    return record;
  };

  const update = async (projectId: string, name: string, input: UpdateInput) => {
    const existing = await getByName(projectId, name);
    if (!existing) return null;

    const timestamp = nowTimestamp();

    const updated: SkillRecord = {
      ...existing,
      file_id: input.file_id ?? existing.file_id,
      description: input.description ?? existing.description,
      updated_at: timestamp,
    };

    await db
      .update(skills)
      .set({ file_id: updated.file_id, description: updated.description, updated_at: updated.updated_at })
      .where(eq(skills.id, existing.id));

    return updated;
  };

  const remove = async (projectId: string, name: string) => {
    const existing = await getByName(projectId, name);
    if (!existing) return false;

    await db.update(skills).set({ deleted_at: nowTimestamp() }).where(eq(skills.id, existing.id));
    return true;
  };

  return { list, getByName, create, update, remove };
};
