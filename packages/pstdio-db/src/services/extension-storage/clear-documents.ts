import { and, eq } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import type { DbClient } from "../../db/connection.pglite";
import {
  projects,
  storage_document_operations,
  storage_document_updates,
  storage_documents,
} from "../../db/schemas.pg";
import { removeSnapshotOwner } from "./snapshot-content";

type Transaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];

export const clearOwnerDocuments = async (tx: Transaction, owner: StorageOwner) => {
  await tx.select({ id: projects.id }).from(projects).where(eq(projects.id, owner.workbenchId)).for("update");
  await removeSnapshotOwner(tx, owner.workbenchId, owner.extensionId);
  const ownerWhere = (
    table: typeof storage_documents | typeof storage_document_updates | typeof storage_document_operations,
  ) => and(eq(table.workbench_id, owner.workbenchId), eq(table.extension_id, owner.extensionId));
  const documents = await tx
    .select({ id: storage_documents.document_id, revision: storage_documents.revision })
    .from(storage_documents)
    .where(ownerWhere(storage_documents))
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
};
