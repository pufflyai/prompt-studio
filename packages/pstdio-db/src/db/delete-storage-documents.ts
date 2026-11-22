import { and, eq, inArray, type SQL, sql } from "drizzle-orm";
import { coreOwnerId } from "pstdio-sync/records";
import { trackDocumentFiles } from "../services/extension-storage/document-files";
import type { DbClient } from "./connection.pglite";
import { documents as storage_documents } from "./schemas/documents";
import { owners, storage_current_records } from "./schemas.pg";

/** Record query state belongs to the records document even though its counters share the owner row. */
export const deleteStorageDocuments = async (db: DbClient, where: SQL) =>
  db.transaction(async (tx) => {
    const removed = await tx
      .select({ id: storage_documents.id, ownerId: storage_documents.owner_id })
      .from(storage_documents)
      .where(where);
    const dependent = removed.length
      ? await tx
          .select({ id: storage_documents.id, ownerId: storage_documents.owner_id })
          .from(storage_documents)
          .where(
            inArray(
              storage_documents.room_of,
              removed.map((row) => row.id),
            ),
          )
      : [];
    const addresses = await tx
      .select({ id: owners.id, project: owners.project_id })
      .from(owners)
      .where(inArray(owners.id, [...new Set(removed.map((row) => row.ownerId))]));
    const projects = new Map(addresses.map((row) => [row.id, row.project]));
    for (const row of [...removed, ...dependent]) trackDocumentFiles(tx, projects.get(row.ownerId)!, row.id);
    const roots = await tx
      .select({ ownerId: storage_documents.owner_id })
      .from(storage_documents)
      .where(and(where, eq(storage_documents.key, "records")));
    if (roots.length) {
      const ids = roots.map((row) => row.ownerId);
      await tx.delete(storage_current_records).where(inArray(storage_current_records.owner_id, ids));
      const coreProjects = sql`SELECT project_id FROM owners WHERE id IN (${sql.join(
        ids.map((id) => sql`${id}`),
        sql`, `,
      )}) AND extension_id=${coreOwnerId}`;
      // Discard only the shown projection; the ordered journal still owns confirmed claims.
      await tx.execute(
        sql`UPDATE resource_numbers SET current=false,alias=false WHERE project_id IN (${coreProjects})`,
      );
      await tx.execute(sql`DELETE FROM resource_numbers WHERE NOT canonical AND project_id IN (${coreProjects})`);
      // Keep the generation monotonic for cursors, cached counts and saved recovery copies.
      await tx
        .update(owners)
        .set({
          revision: sql`${owners.revision} + 1`,
          live_count: 0,
          numbers_revision: sql`CASE WHEN ${owners.extension_id}=${coreOwnerId} THEN ${owners.revision}+1 ELSE ${owners.numbers_revision} END`,
        })
        .where(inArray(owners.id, ids));
    }
    await tx.delete(storage_documents).where(where);
  });
