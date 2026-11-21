import { and, asc, eq, gt, inArray, isNull, notInArray } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { files as fileRows, skills } from "../../db/schemas.pg";
import { type PageQuery, pageBoundary, pageLimit } from "../query-page";

type SkillRow = typeof skills.$inferSelect;
type SkillFileRow = SkillFileMembership;

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

  const rows = await db
    .select({ owner: fileRows.owner, path: fileRows.path, file_id: fileRows.id })
    .from(fileRows)
    .where(
      and(
        inArray(
          fileRows.owner,
          skillIds.map((id) => `skill:${id}`),
        ),
        isNull(fileRows.scope),
      ),
    );
  const grouped = new Map<string, SkillFileRow[]>();

  for (const row of rows) {
    if (row.path === null) continue;
    const id = row.owner!.slice("skill:".length);
    const list = grouped.get(id) ?? [];
    list.push({ path: row.path, file_id: row.file_id });
    grouped.set(id, list);
  }

  const result = new Map<string, SkillFileMembership[]>();
  for (const [skillId, items] of grouped) result.set(skillId, sortFiles(items));
  return result;
};

const decorate = (row: SkillRow, files: SkillFileMembership[]): SkillRecord => ({ ...row, files });

const replaceSkillFiles = async (
  db: Pick<DbClient, "select" | "update">,
  projectId: string,
  skillId: string,
  files: SkillFileMembership[],
) => {
  if (
    new Set(files.map((file) => file.path)).size !== files.length ||
    new Set(files.map((file) => file.file_id)).size !== files.length
  )
    throw new Error("Skill paths and files must be unique.");
  const owner = `skill:${skillId}`;
  const rows = files.length
    ? await db
        .select()
        .from(fileRows)
        .where(
          inArray(
            fileRows.id,
            files.map((file) => file.file_id),
          ),
        )
        .orderBy(fileRows.id)
        .for("update")
    : [];
  if (
    rows.length !== files.length ||
    rows.some(
      (row) => row.project_id !== projectId || (row.owner !== null && row.owner !== "pstdio" && row.owner !== owner),
    )
  )
    throw new Error("Skill files must belong to this project and owner.");
  await db
    .update(fileRows)
    .set({ owner: null, scope: null, path: null })
    .where(and(eq(fileRows.owner, owner), eq(fileRows.project_id, projectId)));
  for (const file of files)
    await db.update(fileRows).set({ owner, scope: null, path: file.path }).where(eq(fileRows.id, file.file_id));
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

  const queryCandidates = async (projectId: string, input: PageQuery, excludedNames: string[]) => {
    const boundary = pageBoundary(input.cursor, `skills:${projectId}`);
    const rows = await db
      .select()
      .from(skills)
      .where(
        and(
          eq(skills.project_id, projectId),
          isNull(skills.deleted_at),
          boundary ? gt(skills.id, boundary) : undefined,
          excludedNames.length ? notInArray(skills.name, excludedNames) : undefined,
        ),
      )
      .orderBy(asc(skills.id))
      .limit(pageLimit(input) + 1);
    const filesById = await loadFilesBySkillIds(
      db,
      rows.map((row) => row.id),
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

    return db.transaction(async (tx) => {
      await tx.insert(skills).values(row);
      await replaceSkillFiles(tx, input.project_id, row.id, files);
      return decorate(row, sortMembership(files));
    });
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

    return db.transaction(async (tx) => {
      await tx
        .update(skills)
        .set({ description: nextRow.description, updated_at: nextRow.updated_at })
        .where(eq(skills.id, existing.id));
      const nextFiles = input.files ?? existing.files;
      if (input.files) await replaceSkillFiles(tx, projectId, existing.id, input.files);
      return decorate(nextRow, sortMembership(nextFiles));
    });
  };

  const remove = async (projectId: string, name: string) => {
    const existing = await getByName(projectId, name);
    if (!existing) return false;

    await db.update(skills).set({ deleted_at: nowTimestamp() }).where(eq(skills.id, existing.id));
    return true;
  };

  return { queryCandidates, list, getByName, create, update, remove };
};
