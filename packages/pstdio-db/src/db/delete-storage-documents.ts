import { and, eq, inArray, type SQL, sql } from "drizzle-orm";
import type { DbClient } from "./connection.pglite";
import { owners, storage_current_records, storage_documents } from "./schemas.pg";

/** Record query state belongs to the records document even though its counters share the owner row. */
export const deleteStorageDocuments = async (db: DbClient, where: SQL) =>
  db.transaction(async (tx) => {
    const roots = await tx
      .select({ ownerId: storage_documents.owner_id })
      .from(storage_documents)
      .where(and(where, eq(storage_documents.document_id, "records")));
    if (roots.length) {
      const ids = roots.map((row) => row.ownerId);
      await tx.delete(storage_current_records).where(inArray(storage_current_records.owner_id, ids));
      // Keep the generation monotonic for cursors, cached counts and saved recovery copies.
      await tx
        .update(owners)
        .set({ revision: sql`${owners.revision} + 1`, live_count: 0 })
        .where(inArray(owners.id, ids));
    }
    await tx.delete(storage_documents).where(where);
  });
