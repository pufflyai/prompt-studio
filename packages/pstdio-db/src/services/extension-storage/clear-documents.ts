import { and, eq, like, not, or } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import type { Json, StorageRecordIndex } from "pstdio-sync-contracts";
import type { DbClient } from "../../db/connection.pglite";
import {
  owners,
  storage_current_records,
  storage_document_operations,
  storage_document_updates,
  storage_documents,
} from "../../db/schemas.pg";
import { formatDatabasePrefix } from "./record-format-key";
import { dropRecordIndexObjects, installRecordIndex } from "./record-index-lifecycle";
import { recordIndexRows as storage_record_indexes } from "./record-index-rows";
import { decodeProjectionValue } from "./record-projection-codec";
import { resourceDocumentId } from "./resource-document-persistence";
import { storageOwnerKey, storageOwnerWhere } from "./storage-owner-key";

type Transaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];

export const clearOwnerDocuments = async (tx: Transaction, owner: StorageOwner) => {
  // Generated SQL objects have no FK lifetime; remove them while their declarations still exist.
  const indexes = await tx
    .select({ definition: storage_record_indexes.definition, database_name: storage_record_indexes.database_name })
    .from(storage_record_indexes)
    .where(eq(storage_record_indexes.owner_id, storageOwnerKey(owner)));
  await dropRecordIndexObjects(tx, indexes);
  const ownerWhere = (
    table:
      | typeof storage_documents
      | typeof storage_document_updates
      | typeof storage_document_operations
      | typeof storage_current_records,
  ) => and(eq(table.owner_id, storageOwnerKey(owner)));
  // Record documents and ordered markers/caches are removed outright; update tails cascade with them.
  // An emptied marker would no longer decode, and a cleared owner founds or joins its stream again.
  const recordDocuments = or(
    like(storage_documents.document_id, `${resourceDocumentId("").slice(0, -2)}%`),
    like(storage_documents.document_id, '["ordered-%'),
  )!;
  await tx.delete(storage_documents).where(and(ownerWhere(storage_documents), recordDocuments));
  const documents = await tx
    .select({ id: storage_documents.document_id, revision: storage_documents.revision })
    .from(storage_documents)
    .where(and(ownerWhere(storage_documents), not(recordDocuments)))
    .for("update");
  for (const document of documents) {
    const revision = document.revision + 1;
    // Keep revisions monotonic so every running service drops its pre-purge cached document.
    await tx
      .update(storage_documents)
      .set({
        state: new Uint8Array([0, 0]),
        revision,
        folded_revision: revision,
      })
      .where(and(ownerWhere(storage_documents), eq(storage_documents.document_id, document.id)));
  }
  await tx.delete(storage_document_updates).where(ownerWhere(storage_document_updates));
  await tx.delete(storage_document_operations).where(ownerWhere(storage_document_operations));
  await tx.delete(storage_current_records).where(ownerWhere(storage_current_records));
  // Canonical records, stream state, pending saves and receipts share this owner lifetime.
  await tx.delete(owners).where(storageOwnerWhere(owner));
  // Deleting tool data keeps the installed tool's declared queries usable. Recreate
  // their objects for the new owner generation; derived format caches rebuild on demand.
  for (const index of indexes)
    if (!index.database_name.startsWith(formatDatabasePrefix))
      await installRecordIndex(
        tx,
        owner,
        decodeProjectionValue(index.definition as unknown as Json) as unknown as StorageRecordIndex,
      );
};
