import type { StorageOwner } from "pstdio-sync";
import type { StorageRecordIndex } from "pstdio-sync-contracts";
import type { DbClient } from "../../db/connection.pglite";
import { createDocumentStorageDBService } from "./document-storage";

/** A runtime's owner indexes are accepted together; failed refreshes retain the previous definitions. */
export const installRecordIndexes = (
  db: DbClient,
  owners: { owner: StorageOwner; definitions: StorageRecordIndex[] }[],
  validate: () => void,
) =>
  db.transaction(async (tx) => {
    // This service is private to the transaction: no observer or shared document cache
    // can expose a provisional import or backfill before the whole installation commits.
    const documents = createDocumentStorageDBService(tx);
    for (const { owner, definitions } of owners) await documents.open({ owner }).records.defineIndexes(definitions);
    validate();
  });
