import { and, eq, isNull } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { skills } from "../../db/schemas.pg";

type SkillFile = {
  path: string;
  content: string;
  encoding: "utf8";
};

type SkillRow = typeof skills.$inferSelect;

type SkillRecord = Omit<SkillRow, "files_json" | "file_id"> & {
  files: SkillFile[];
  legacy_file_id: string | null;
};

const nowTimestamp = () => new Date().toISOString();

type CreateInput = {
  project_id: string;
  name: string;
  description: string;
  files: SkillFile[];
};

type UpdateInput = {
  files?: SkillFile[];
  description?: string;
};

const parseFiles = (filesJson: string) => {
  let value: unknown;

  try {
    value = JSON.parse(filesJson);
  } catch {
    return [];
  }

  if (!Array.isArray(value)) return [];

  return value.filter(
    (item): item is SkillFile =>
      !!item &&
      typeof item === "object" &&
      typeof (item as SkillFile).path === "string" &&
      typeof (item as SkillFile).content === "string" &&
      (item as SkillFile).encoding === "utf8",
  );
};

const mapSkill = (row: SkillRow): SkillRecord => {
  return {
    id: row.id,
    project_id: row.project_id,
    name: row.name,
    description: row.description,
    legacy_file_id: row.file_id,
    files: parseFiles(row.files_json),
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  };
};

export const createSkillsDBService = (db: DbClient) => {
  const list = async (projectId: string) => {
    const records = await db
      .select()
      .from(skills)
      .where(and(eq(skills.project_id, projectId), isNull(skills.deleted_at)))
      .orderBy(skills.name);
    return records.map(mapSkill);
  };

  const getByNameRow = async (projectId: string, name: string) => {
    const [skill] = await db
      .select()
      .from(skills)
      .where(and(eq(skills.project_id, projectId), eq(skills.name, name), isNull(skills.deleted_at)));
    return skill ?? null;
  };

  const getByName = async (projectId: string, name: string) => {
    const row = await getByNameRow(projectId, name);
    return row ? mapSkill(row) : null;
  };

  const create = async (input: CreateInput) => {
    const timestamp = nowTimestamp();

    const row: SkillRow = {
      id: crypto.randomUUID(),
      project_id: input.project_id,
      name: input.name,
      description: input.description,
      file_id: null,
      files_json: JSON.stringify(input.files),
      created_at: timestamp,
      updated_at: timestamp,
      deleted_at: null,
    };

    await db.insert(skills).values(row);
    return mapSkill(row);
  };

  const update = async (projectId: string, name: string, input: UpdateInput) => {
    const existingRow = await getByNameRow(projectId, name);
    if (!existingRow) return null;

    const existing = mapSkill(existingRow);

    const timestamp = nowTimestamp();

    const updated: SkillRecord = {
      ...existing,
      files: input.files ?? existing.files,
      description: input.description ?? existing.description,
      updated_at: timestamp,
    };

    await db
      .update(skills)
      .set({
        files_json: JSON.stringify(updated.files),
        description: updated.description,
        updated_at: updated.updated_at,
      })
      .where(eq(skills.id, existing.id));

    return updated;
  };

  const remove = async (projectId: string, name: string) => {
    const existingRow = await getByNameRow(projectId, name);
    if (!existingRow) return false;

    await db.update(skills).set({ deleted_at: nowTimestamp() }).where(eq(skills.id, existingRow.id));
    return true;
  };

  return { list, getByName, create, update, remove };
};
