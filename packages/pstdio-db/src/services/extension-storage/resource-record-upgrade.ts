import { and, asc, eq } from "drizzle-orm";
import { editResourceDocument, readDocumentRecord, type StorageOwner } from "pstdio-sync";
import type { Json, SharedEdit, StorageGroup, StorageRecord } from "pstdio-sync-contracts";
import * as Y from "yjs";
import type { DbClient } from "../../db/connection.pglite";
import { storage_document_updates, storage_documents, storage_record_projections } from "../../db/schemas.pg";
import { publishProjectedRecords } from "./record-projection-rows";
import { persistResourceDocuments, resourceDocumentId } from "./resource-document-persistence";

// Owner metadata that stays in the owner document after its records move out.
const ownerMetadataRoots = ["data-migrations", "sync-documents", "sync-blobs"];

const sharedEdits = (shared: NonNullable<StorageRecord["shared"]>): SharedEdit[] => {
  if (shared.kind === "text") return [{ kind: "text.insert", index: 0, text: shared.value as string }];
  if (shared.kind === "list") return [{ kind: "list.insert", index: 0, values: shared.value as Json[] }];
  return Object.entries(shared.value as Record<string, Json>).map(([key, value]) => ({ kind: "map.set", key, value }));
};

/** The edit that recreates a saved record, with its current value, in a new record document. */
const recreate = (record: StorageRecord): StorageGroup["edits"][number] => {
  if (record.deleted) return { recordId: record.recordId, deleted: true };
  return {
    recordId: record.recordId,
    replace: record.value,
    ...(record.asset && { asset: record.asset }),
    ...(record.shared && { shared: sharedEdits(record.shared) }),
  };
};

/**
 * Moves records that still live in an owner's document into one document per record, once.
 * One transaction keeps an interrupted move invisible: the old document stays authoritative until it commits.
 */
export const upgradeOwnerRecords = (db: DbClient, owner: StorageOwner) =>
  db.transaction(async (tx) => {
    const address = { workbench_id: owner.workbenchId, extension_id: owner.extensionId, document_id: "records" };
    const where = <T extends typeof storage_documents | typeof storage_document_updates>(table: T) =>
      and(
        eq(table.workbench_id, address.workbench_id),
        eq(table.extension_id, address.extension_id),
        eq(table.document_id, address.document_id),
      );
    const [row] = await tx.select().from(storage_documents).where(where(storage_documents)).for("update");
    if (!row) return false;
    const updates = await tx
      .select({ update: storage_document_updates.update })
      .from(storage_document_updates)
      .where(where(storage_document_updates))
      .orderBy(asc(storage_document_updates.revision));
    const document = new Y.Doc();
    try {
      document.transact(() => {
        Y.applyUpdate(document, row.state);
        for (const { update } of updates) Y.applyUpdate(document, update);
      });
      const ids = [...new Set([...document.getMap("records").keys(), ...document.getMap("deleted").keys()])];
      if (!ids.length) return false;
      await tx
        .insert(storage_record_projections)
        .values({ workbench_id: owner.workbenchId, extension_id: owner.extensionId, revision: 0 })
        .onConflictDoNothing();
      for (let offset = 0; offset < ids.length; offset += 500) {
        const saved = await Promise.all(ids.slice(offset, offset + 500).map((id) => readDocumentRecord(document, id)));
        const prepared = await Promise.all(saved.map((record) => editResourceDocument([], recreate(record), true)));
        await persistResourceDocuments(
          tx,
          owner,
          prepared.map((value) => ({
            id: resourceDocumentId(value.record.recordId),
            revision: 1,
            foldedRevision: 0,
            checkpoint: value.checkpoint,
            update: value.update,
          })),
        );
        await publishProjectedRecords(
          tx,
          owner,
          prepared.map((value) => value.record),
        );
      }
      const metadata = new Y.Doc();
      for (const name of ownerMetadataRoots)
        for (const [key, value] of document.getMap(name)) metadata.getMap(name).set(key, value);
      const revision = row.revision + 1;
      await tx
        .update(storage_documents)
        .set({ state: Y.encodeStateAsUpdate(metadata), revision, folded_revision: revision })
        .where(where(storage_documents));
      await tx.delete(storage_document_updates).where(where(storage_document_updates));
      metadata.destroy();
      const [projection] = await tx
        .select({ revision: storage_record_projections.revision })
        .from(storage_record_projections)
        .where(
          and(
            eq(storage_record_projections.workbench_id, owner.workbenchId),
            eq(storage_record_projections.extension_id, owner.extensionId),
          ),
        )
        .for("update");
      await tx
        .update(storage_record_projections)
        .set({ revision: projection.revision + 1 })
        .where(
          and(
            eq(storage_record_projections.workbench_id, owner.workbenchId),
            eq(storage_record_projections.extension_id, owner.extensionId),
          ),
        );
      return true;
    } finally {
      document.destroy();
    }
  });
