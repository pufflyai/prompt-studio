import type { StorageOwner } from "pstdio-sync";
import type { StorageRecordIndex } from "pstdio-sync-contracts";
import type { DbClient } from "../../db/connection.pglite";
import { defineRecordIndexes } from "./record-index-definition";

/** Extension declarations are metadata. Only host code supplies hostManaged for its own fixed definitions. */
export const installRecordIndexes = (
  db: DbClient,
  owners: { owner: StorageOwner; definitions: StorageRecordIndex[]; hostManaged?: boolean }[],
  validate: () => void,
) =>
  db.transaction(async (tx) => {
    // Indexes describe the existing query projection. Importing an owner's history here
    // nests conversion in the catalog transaction and rolls every owner back on failure.
    for (const { owner, definitions, hostManaged } of owners)
      await defineRecordIndexes(tx, owner, definitions, hostManaged ? "host-index" : "query");
    validate();
  });
