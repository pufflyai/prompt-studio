import { and, eq, inArray, isNull } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { skill_files, skills } from "../../db/schemas.pg";

type SkillRow = typeof skills.$inferSelect;
type SkillFileRow = typeof skill_files.$inferSelect;

export type SkillFileMembership = { path: string; file_id: string };

export type SkillRecord = SkillRow & {
  files: SkillFileMembership[];
};

const nowTimestamp = () => new Date().toISOString();

type CreateInput = {
  project_id: string;
  name: string;
  description: string;
  files?: SkillFileMembership[];
};

type UpdateInput = {
  description?: string;
  files?: SkillFileMembership[];
};

const sortFiles = (rows: SkillFileRow[]) =>
  rows
    .map<SkillFileMembership>((row) => ({ path: row.path, file_id: row.file_id }))
    .sort((a, b) => {
      if (a.path === "SKILL.md") return -1;
      if (b.path === "SKILL.md") return 1;
      return a.path.localeCompare(b.path);
    });

const loadFilesBySkillIds = async (db: DbClient, skillIds: string[]) => {
  if (skillIds.length === 0) return new Map<string, SkillFileMembership[]>();

  const rows = await db.select().from(skill_files).where(inArray(skill_files.skill_id, skillIds));
  const grouped = new Map<string, SkillFileRow[]>();

  for (const row of rows) {
    const list = grouped.get(row.skill_id) ?? [];
    list.push(row);
    grouped.set(row.skill_id, list);
  }

  const result = new Map<string, SkillFileMembership[]>();
  for (const [skillId, items] of grouped) result.set(skillId, sortFiles(items));
  return result;
};

const decorate = (row: SkillRow, files: SkillFileMembership[]): SkillRecord => ({ ...row, files });

const replaceSkillFiles = async (
  db: DbClient,
  projectId: string,
  skillId: string,
  files: SkillFileMembership[],
  timestamp: string,
) => {
  await db.delete(skill_files).where(eq(skill_files.skill_id, skillId));
  if (files.length === 0) return;

  await db.insert(skill_files).values(
    files.map((file) => ({
      project_id: projectId,
      skill_id: skillId,
      path: file.path,
      file_id: file.file_id,
      created_at: timestamp,
      updated_at: timestamp,
    })),
  );
};

const sortMembership = (files: SkillFileMembership[]) =>
  [...files].sort((a, b) => {
    if (a.path === "SKILL.md") return -1;
    if (b.path === "SKILL.md") return 1;
    return a.path.localeCompare(b.path);
  });

export const createSkillsDBService = (db: DbClient) => {
  const list = async (projectId: string) => {
    const rows = await db
      .select()
      .from(skills)
      .where(and(eq(skills.project_id, projectId), isNull(skills.deleted_at)))
      .orderBy(skills.name);
    const filesById = await loadFilesBySkillIds(
      db,
      rows.map((r) => r.id),
    );
    return rows.map((row) => decorate(row, filesById.get(row.id) ?? []));
  };

  const getByName = async (projectId: string, name: string) => {
    const [row] = await db
      .select()
      .from(skills)
      .where(and(eq(skills.project_id, projectId), eq(skills.name, name), isNull(skills.deleted_at)));
    if (!row) return null;
    const filesById = await loadFilesBySkillIds(db, [row.id]);
    return decorate(row, filesById.get(row.id) ?? []);
  };

  const create = async (input: CreateInput) => {
    const timestamp = nowTimestamp();
    const files = input.files ?? [];

    const row: SkillRow = {
      id: crypto.randomUUID(),
      project_id: input.project_id,
      name: input.name,
      description: input.description,
      created_at: timestamp,
      updated_at: timestamp,
      deleted_at: null,
    };

    await db.insert(skills).values(row);
    await replaceSkillFiles(db, input.project_id, row.id, files, timestamp);

    return decorate(row, sortMembership(files));
  };

  const update = async (projectId: string, name: string, input: UpdateInput) => {
    const existing = await getByName(projectId, name);
    if (!existing) return null;

    const timestamp = nowTimestamp();

    const nextRow: SkillRow = {
      ...existing,
      description: input.description ?? existing.description,
      updated_at: timestamp,
    };

    await db
      .update(skills)
      .set({ description: nextRow.description, updated_at: nextRow.updated_at })
      .where(eq(skills.id, existing.id));

    const nextFiles = input.files ?? existing.files;
    if (input.files) {
      await replaceSkillFiles(db, projectId, existing.id, input.files, timestamp);
    }

    return decorate(nextRow, sortMembership(nextFiles));
  };

  const remove = async (projectId: string, name: string) => {
    const existing = await getByName(projectId, name);
    if (!existing) return false;

    await db.update(skills).set({ deleted_at: nowTimestamp() }).where(eq(skills.id, existing.id));
    return true;
  };

  return { list, getByName, create, update, remove };
};
