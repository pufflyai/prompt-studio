import { and, eq } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { files, ticket_files } from "../../db/schemas.pg";

const nowTimestamp = () => new Date().toISOString();

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

  const listForTicket = async (ticketId: string) => {
    const rows = await db
      .select({ file: files })
      .from(ticket_files)
      .innerJoin(files, eq(ticket_files.file_id, files.id))
      .where(eq(ticket_files.ticket_id, ticketId))
      .orderBy(ticket_files.created_at);

    return rows.map((row) => row.file);
  };

  const attachToTicket = async (ticketId: string, fileId: string) => {
    const link = {
      id: crypto.randomUUID(),
      ticket_id: ticketId,
      file_id: fileId,
      created_at: nowTimestamp(),
    };

    await db.insert(ticket_files).values(link);

    return link;
  };

  const detachFromTicket = async (ticketId: string, fileId: string) => {
    const [existing] = await db
      .select()
      .from(ticket_files)
      .where(and(eq(ticket_files.ticket_id, ticketId), eq(ticket_files.file_id, fileId)));

    if (!existing) return false;

    await db.delete(ticket_files).where(and(eq(ticket_files.ticket_id, ticketId), eq(ticket_files.file_id, fileId)));

    return true;
  };

  return { list, get, insert, updateMetadata, remove, listForTicket, attachToTicket, detachFromTicket };
};
