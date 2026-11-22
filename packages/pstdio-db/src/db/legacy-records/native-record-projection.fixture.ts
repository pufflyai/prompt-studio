import { and, eq, sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import type { StorageRecord } from "pstdio-sync-contracts";
import { materializeNativeRecord } from "../../services/extension-storage/native-record-projection";
import { derivedQueryValues, readDerivedQueryIndexes } from "../../services/extension-storage/record-derived-fields";
import { decodeProjectionValue, encodeProjectionValue } from "../../services/extension-storage/record-projection-codec";
import { storageOwnerKey } from "../../services/extension-storage/storage-owner-key";
import type { DbClient } from "../connection.pglite";
import { owners as recordOwners, storage_current_records } from "../schemas.pg";

export { lockStorageProject } from "../../services/extension-storage/native-record-projection";

type Transaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];

/** Only indexed bindings for this standalone text are refreshed; no record documents are loaded. */
export const refreshNativeRecordText = async (tx: Transaction, owner: StorageOwner, key: string, content: string) => {
  const rows = await tx
    .select()
    .from(storage_current_records)
    .where(
      and(
        eq(storage_current_records.owner_id, storageOwnerKey(owner)),
        eq(storage_current_records.deleted, false),
        sql`${storage_current_records.native_sources} ? ${key}`,
      ),
    );
  let changed = 0;
  const derived = await readDerivedQueryIndexes(tx, owner);
  for (const row of rows) {
    const record = await materializeNativeRecord(
      {
        recordId: row.record_id,
        exists: true,
        deleted: row.deleted,
        value: decodeProjectionValue(row.value),
        asset: decodeProjectionValue(row.asset) as StorageRecord["asset"],
        shared: decodeProjectionValue(row.shared) as StorageRecord["shared"],
        revision: row.revision,
        nativeSources: row.native_sources,
        nativeVersions: row.native_versions,
      },
      new Map([[key, content]]),
    );
    if (record.revision === row.revision) continue;
    await tx
      .update(storage_current_records)
      .set({
        value: encodeProjectionValue(record.value),
        query_values: encodeProjectionValue(derivedQueryValues(derived, record)) as typeof row.query_values,
        revision: record.revision,
        native_versions: record.nativeVersions ?? {},
      })
      .where(
        and(
          eq(storage_current_records.owner_id, storageOwnerKey(owner)),
          eq(storage_current_records.record_id, row.record_id),
        ),
      );
    changed++;
  }
  if (changed)
    await tx
      .update(recordOwners)
      .set({ revision: sql`${recordOwners.revision} + 1` })
      .where(and(eq(recordOwners.id, storageOwnerKey(owner))));
  return changed;
};
