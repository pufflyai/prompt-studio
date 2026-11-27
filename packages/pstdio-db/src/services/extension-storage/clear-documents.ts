import { eq, sql } from "drizzle-orm";
import { resourceActivityOwnerId } from "pstdio-api-contracts";
import type { StorageOwner } from "pstdio-sync";
import { coreOwnerId } from "pstdio-sync/records";
import type { Json, StorageRecordIndex } from "pstdio-sync-contracts";
import type { DbClient } from "../../db/connection.pglite";
import { owners, records } from "../../db/schemas.pg";
import { formatDatabasePrefix } from "./record-format-key";
import { dropRecordIndexObjects, installRecordIndex, saveQueryDefinition } from "./record-index-lifecycle";
import { recordIndexRows as storage_record_indexes } from "./record-index-rows";
import { decodeProjectionValue } from "./record-projection-codec";
import { storageOwnerKey, storageOwnerWhere } from "./storage-owner-key";

type Transaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];

export const clearOwnerDocuments = async (tx: Transaction, owner: StorageOwner) => {
  // Generated SQL objects have no FK lifetime; remove them while their declarations still exist.
  const indexes = await tx
    .select({ definition: storage_record_indexes.definition, database_name: storage_record_indexes.database_name })
    .from(storage_record_indexes)
    .where(eq(storage_record_indexes.owner_id, storageOwnerKey(owner)));
  await dropRecordIndexObjects(tx, indexes);
  await tx.delete(records).where(eq(records.owner_id, storageOwnerKey(owner)));
  if (owner.extensionId === coreOwnerId) {
    await tx.execute(sql`DELETE FROM resource_numbers WHERE project_id=${owner.workbenchId}`);
  }
  // Canonical records, stream state, pending saves and receipts share this owner lifetime.
  await tx.delete(owners).where(storageOwnerWhere(owner));
  // Deleting tool data keeps the installed tool's declared queries usable. Recreate
  // their objects for the new owner generation; derived format caches rebuild on demand.
  for (const index of indexes) {
    if (index.database_name.startsWith(formatDatabasePrefix)) continue;
    const hostIndex =
      index.database_name.startsWith("storage_host_") ||
      (owner.extensionId === resourceActivityOwnerId && index.database_name.startsWith("storage_query_"));
    const install = hostIndex ? installRecordIndex : saveQueryDefinition;
    await install(
      tx,
      owner,
      decodeProjectionValue(index.definition as unknown as Json) as unknown as StorageRecordIndex,
    );
  }
};
