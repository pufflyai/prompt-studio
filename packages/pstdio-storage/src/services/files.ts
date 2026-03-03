import { createHash } from "node:crypto";
import fs from "node:fs";
import { and, eq } from "drizzle-orm";
import type { DbClient } from "pstdio-db";
import { files, ticket_files } from "pstdio-db";
import { ensureProjectStorageRoot, resolveFileStoragePath } from "../storage/paths";

const nowTimestamp = () => new Date().toISOString();

export const createFilesService = (db: DbClient, storageRoot: string) => {
  const listByProject = async (projectId: string) =>
    db.select().from(files).where(eq(files.project_id, projectId)).orderBy(files.created_at);

  const get = async (fileId: string) => {
    const rows = await db.select().from(files).where(eq(files.id, fileId));

    return rows[0] ?? null;
  };

  const upload = async (input: {
    project_id: string;
    file_name: string;
    file_kind: string;
    data: Buffer;
    mime_type?: string | null;
  }) => {
    const timestamp = nowTimestamp();
    const id = crypto.randomUUID();

    ensureProjectStorageRoot(storageRoot, input.project_id);
    const storage_path = resolveFileStoragePath(storageRoot, input.project_id, id);

    fs.writeFileSync(storage_path, input.data);

    const hash = createHash("sha256").update(input.data).digest("hex");

    const file = {
      id,
      project_id: input.project_id,
      file_name: input.file_name,
      file_kind: input.file_kind,
      storage_path,
      mime_type: input.mime_type ?? null,
      size_bytes: input.data.byteLength,
      hash,
      created_at: timestamp,
      updated_at: timestamp,
    };

    await db.insert(files).values(file);

    return file;
  };

  const remove = async (fileId: string) => {
    const existing = await get(fileId);

    if (!existing) return false;

    fs.unlinkSync(existing.storage_path);

    await db.delete(files).where(eq(files.id, fileId));

    return true;
  };

  const update = async (fileId: string, input: { data: Buffer }) => {
    const existing = await get(fileId);

    if (!existing) {
      return null;
    }

    fs.writeFileSync(existing.storage_path, input.data);

    const updated = {
      ...existing,
      size_bytes: input.data.byteLength,
      hash: createHash("sha256").update(input.data).digest("hex"),
      updated_at: nowTimestamp(),
    };

    await db
      .update(files)
      .set({
        size_bytes: updated.size_bytes,
        hash: updated.hash,
        updated_at: updated.updated_at,
      })
      .where(eq(files.id, fileId));

    return updated;
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
    const existing = await get(fileId);

    if (!existing) return null;

    const link = {
      id: crypto.randomUUID(),
      ticket_id: ticketId,
      file_id: fileId,
      created_at: nowTimestamp(),
    };

    await db.insert(ticket_files).values(link);

    return existing;
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

  return {
    upload,
    get,
    update,
    remove,
    listByProject,
    listForTicket,
    attachToTicket,
    detachFromTicket,
  };
};
