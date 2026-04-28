import { eq } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { files } from "../../db/schemas.pg";

export const createFilesDBService = (db: DbClient) => {
  const list = async (projectId: string) =>
    db.select().from(files).where(eq(files.project_id, projectId)).orderBy(files.created_at);

  const get = async (fileId: string) => {
    const rows = await db.select().from(files).where(eq(files.id, fileId));
    return rows[0] ?? null;
  };

  const insert = async (file: typeof files.$inferInsert) => {
    await db.insert(files).values(file);
  };

  const updateMetadata = async (fileId: string, input: { size_bytes: number; hash: string; updated_at: string }) => {
    await db
      .update(files)
      .set({ size_bytes: input.size_bytes, hash: input.hash, updated_at: input.updated_at })
      .where(eq(files.id, fileId));
  };

  const remove = async (fileId: string) => {
    await db.delete(files).where(eq(files.id, fileId));
  };

  return { list, get, insert, updateMetadata, remove };
};
