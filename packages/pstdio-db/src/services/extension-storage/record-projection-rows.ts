import { sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import { assertStorageLimits } from "pstdio-sync-contracts";
import type { DbClient } from "../../db/connection.pglite";
import { jsonBatches } from "./json-batches";
import { type NativeProjectedRecord, projectNativeRecordText } from "./native-record-projection";
import { encodeProjectionValue } from "./record-projection-codec";

type Transaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];

/** Writes the query rows of saved records in their commit's transaction. Unchanged rows stay as they are. */
export const publishProjectedRecords = async (tx: Transaction, owner: StorageOwner, input: NativeProjectedRecord[]) => {
  const records = await Promise.all(input.map((record) => projectNativeRecordText(tx, owner, record)));
  assertStorageLimits(records);
  let projected = 0;
  const rows = records.map((record) => ({
    record_id: record.recordId,
    deleted: record.deleted,
    value: encodeProjectionValue(record.value),
    asset: encodeProjectionValue(record.asset),
    shared: encodeProjectionValue(record.shared),
    revision: record.revision,
    native_sources: record.nativeSources ?? {},
    native_versions: record.nativeVersions ?? {},
    record_lifetime: record.recordLifetime ?? "",
  }));
  for (const batch of jsonBatches(rows)) {
    const changed = await tx.execute(sql`
      INSERT INTO storage_current_records (workbench_id, extension_id, record_id, deleted, value, asset, shared, revision, native_sources, native_versions, record_lifetime)
      SELECT ${owner.workbenchId}, ${owner.extensionId}, input.record_id, input.deleted, input.value, input.asset, input.shared, input.revision, input.native_sources, input.native_versions, input.record_lifetime
      FROM jsonb_to_recordset(${batch}::jsonb)
        AS input(record_id text, deleted boolean, value jsonb, asset jsonb, shared jsonb, revision text, native_sources jsonb, native_versions jsonb, record_lifetime text)
      ON CONFLICT (workbench_id, extension_id, record_id) DO UPDATE SET
        deleted = excluded.deleted, value = excluded.value, asset = excluded.asset, shared = excluded.shared,
        revision = excluded.revision, native_sources = excluded.native_sources, native_versions = excluded.native_versions,
        record_lifetime = excluded.record_lifetime
      WHERE storage_current_records.revision <> excluded.revision OR storage_current_records.record_lifetime <> excluded.record_lifetime
      RETURNING record_id
    `);
    projected += changed.rows.length;
  }
  return projected;
};
