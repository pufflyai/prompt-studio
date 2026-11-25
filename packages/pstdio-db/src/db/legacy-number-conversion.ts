import { and, eq } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import { coreOwnerId, resourceNumbersDocumentId } from "pstdio-sync/records";
import { runDocumentTransaction } from "../services/extension-storage/document-persistence";
import { createDocumentStorageDBService } from "../services/extension-storage/document-storage";
import { storageOwnerKey } from "../services/extension-storage/storage-owner-key";
import {
  legacyNumberBatches,
  numberEditBatches,
  planResourceNumberBatch,
  saveResourceNumberEdits,
} from "../services/resource-number-upgrade";
import type { DbClient } from "./connection.pglite";
import { retainLegacyNumberHistory } from "./legacy-number-history";
import { prepareLegacyNumberInput } from "./legacy-number-input";
import { rebuildLegacyNumberProjection } from "./legacy-number-projection";
import { documents as storage_documents } from "./schemas/documents";

/** Admit local old number documents before any service can observe the project. */
export const convertLegacyNumbers = async (
  db: DbClient,
  database: string,
  owner: StorageOwner,
  signal?: AbortSignal,
) => {
  if (owner.extensionId !== coreOwnerId) return;
  const where = and(
    eq(storage_documents.owner_id, storageOwnerKey(owner)),
    eq(storage_documents.key, resourceNumbersDocumentId),
  );
  if (!(await db.select({ id: storage_documents.key }).from(storage_documents).where(where)).length) return;
  const loaded = await db.transaction((tx) =>
    runDocumentTransaction(
      tx,
      {
        owner,
        address: {
          workbench_id: owner.workbenchId,
          extension_id: owner.extensionId,
          document_id: resourceNumbersDocumentId,
        },
      },
      async () => {},
    ),
  );
  const documents = createDocumentStorageDBService(db);
  try {
    const archive = await prepareLegacyNumberInput(db, database, owner);
    await rebuildLegacyNumberProjection(db, owner, signal);
    const records = documents.open({ owner }).records;
    for (const batch of legacyNumberBatches(loaded.document)) {
      signal?.throwIfAborted();
      for (const edits of numberEditBatches(await planResourceNumberBatch(records, batch))) {
        signal?.throwIfAborted();
        await records.transaction((transaction) => saveResourceNumberEdits(transaction, edits));
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
    await retainLegacyNumberHistory(db, owner, loaded.document, signal);
    signal?.throwIfAborted();
    await archive();
    await db.delete(storage_documents).where(where);
  } finally {
    loaded.document.destroy();
    await documents.flushStatistics();
  }
};
