import type { StorageOwner } from "pstdio-sync";
import type { StorageRecordIndex } from "pstdio-sync-contracts";
import type { DbClient } from "../../db/connection.pglite";
import { createRecordQueries } from "./record-queries";

/** A runtime's owner indexes are accepted together; failed refreshes retain the previous definitions. */
export const installRecordIndexes = (
  db: DbClient,
  owners: { owner: StorageOwner; definitions: StorageRecordIndex[] }[],
  validate: () => void,
) =>
  db.transaction(async (tx) => {
    // Indexes describe the existing query projection. Importing an owner's history here
    // nests conversion in the catalog transaction and rolls every owner back on failure.
    for (const { owner, definitions } of owners) await createRecordQueries(tx, owner).defineIndexes(definitions);
    validate();
  });
