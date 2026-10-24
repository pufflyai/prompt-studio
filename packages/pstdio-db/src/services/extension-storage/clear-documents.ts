import { and, eq, like, not, sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import type { DbClient } from "../../db/connection.pglite";
import {
  recovery_point_owners,
  storage_current_records,
  storage_document_operations,
  storage_document_updates,
  storage_documents,
  storage_record_projections,
} from "../../db/schemas.pg";
import { resourceDocumentId } from "./resource-document-persistence";

type Transaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];

export const clearOwnerDocuments = async (tx: Transaction, owner: StorageOwner) => {
  const ownerWhere = (
    table:
      | typeof storage_documents
      | typeof storage_document_updates
      | typeof storage_document_operations
      | typeof storage_current_records
      | typeof storage_record_projections,
  ) => and(eq(table.workbench_id, owner.workbenchId), eq(table.extension_id, owner.extensionId));
  // Record documents are removed outright; their update tails cascade with them.
  const recordDocuments = like(storage_documents.document_id, `${resourceDocumentId("").slice(0, -2)}%`);
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
  // Removing an extension's data also removes the copies kept for recovery.
  await tx
    .delete(recovery_point_owners)
    .where(
      and(
        eq(recovery_point_owners.workbench_id, owner.workbenchId),
        eq(recovery_point_owners.extension_id, owner.extensionId),
      ),
    );
  // Advancing the owner revision rejects cursors issued before the purge.
  await tx
    .update(storage_record_projections)
    .set({ revision: sql`${storage_record_projections.revision} + 1`, live_count: 0 })
    .where(ownerWhere(storage_record_projections));
};
