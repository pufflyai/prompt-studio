import { eq, getTableColumns, sql } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { databaseAuthorityFor } from "../../db/database-authority";
import { files } from "../../db/schemas.pg";

const { owner, scope, path, ...columns } = getTableColumns(files);
export const fileColumns = columns;

export const createFilesDBService = (db: DbClient) => {
  const list = async (projectId: string) =>
    db.select(fileColumns).from(files).where(eq(files.project_id, projectId)).orderBy(files.created_at);

  const get = async (fileId: string) => {
    const rows = await db.select(fileColumns).from(files).where(eq(files.id, fileId));
    return rows[0] ?? null;
  };

  const insert = async (file: typeof files.$inferInsert) => {
    await db.insert(files).values({ owner: "pstdio", ...file });
  };

  const updateMetadata = (
    fileId: string,
    input: { size_bytes: number; hash: string; updated_at: string },
    beforeWrite?: (file: typeof files.$inferSelect) => void | Promise<void>,
  ) =>
    db.transaction(async (tx) => {
      const [file] = await tx.select().from(files).where(eq(files.id, fileId)).for("update");
      if (!file) return false;
      await beforeWrite?.(file);
      await tx.update(files).set(input).where(eq(files.id, fileId));
      return true;
    });

  const remove = (fileId: string, beforeDelete?: (file: typeof files.$inferSelect) => void | Promise<void>) =>
    db.transaction(async (tx) => {
      const [file] = await tx.select().from(files).where(eq(files.id, fileId)).for("update");
      if (!file) return false;
      if (file.owner?.startsWith("skill:")) throw new Error("File belongs to a skill.");
      const {
        rows: [references],
      } = await tx.execute<{ used: boolean }>(sql`SELECT
        EXISTS(SELECT 1 FROM sessions WHERE session_file_id = ${fileId}) OR
        EXISTS(SELECT 1 FROM workspaces WHERE startup_log_file_id = ${fileId}) AS used`);
      if (references.used) throw new Error("File is in use by a session or workspace.");
      await beforeDelete?.(file);
      await tx.delete(files).where(eq(files.id, fileId));
      return true;
    });

  return { list, get, insert, updateMetadata, remove, authority: databaseAuthorityFor(db) };
};
