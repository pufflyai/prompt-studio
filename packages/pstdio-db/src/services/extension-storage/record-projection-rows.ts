import { sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import { assertStorageLimits } from "pstdio-sync-contracts";
import type { DbClient } from "../../db/connection.pglite";
import { jsonBatches } from "./json-batches";
import { type NativeProjectedRecord, projectNativeRecordText } from "./native-record-projection";
import { derivedQueryValues, readDerivedQueryIndexes } from "./record-derived-fields";
import { encodeProjectionValue } from "./record-projection-codec";
import { identityQueryKey } from "./resource-query-values";
import { storageOwnerKey } from "./storage-owner-key";

type Transaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];

const jsonInput = (value: unknown) =>
  value === null || value === undefined ? sql`NULL::jsonb` : sql`${JSON.stringify(value)}::jsonb`;

/** Writes the query rows of saved records in their commit's transaction. Unchanged rows stay as they are. */
export const publishProjectedRecords = async (tx: Transaction, owner: StorageOwner, input: NativeProjectedRecord[]) => {
  const records = await Promise.all(input.map((record) => projectNativeRecordText(tx, owner, record)));
  assertStorageLimits(records);
  return writeProjectedRecords(tx, owner, records);
};

/** Already materialized records. Snapshot callers validate each record rather than one author group. */
export const writeProjectedRecords = async (tx: Transaction, owner: StorageOwner, records: NativeProjectedRecord[]) => {
  let projected = 0;
  const derived = await readDerivedQueryIndexes(tx, owner);
  const rows = records.map((record) => ({
    record_id: record.recordId,
    deleted: record.deleted,
    value: encodeProjectionValue(record.value),
    query_values: encodeProjectionValue(derivedQueryValues(derived, record)),
    asset: encodeProjectionValue(record.asset),
    shared: encodeProjectionValue(record.shared),
    revision: record.revision,
    native_sources: encodeProjectionValue((record.nativeSources ?? {}) as never),
    native_versions: record.nativeVersions ?? {},
    record_lifetime: record.recordLifetime ?? "",
  }));
  const inputs = function* () {
    if (rows.length === 1) {
      const row = rows[0]!;
      // An ordinary edit already has scalar fields. Avoid parsing a surrounding
      // JSON recordset only to unpack that one row again in Postgres.
      yield sql`VALUES (${storageOwnerKey(owner)}, ${row.record_id}, ${row.deleted},
        ${jsonInput(row.value)}, ${jsonInput(row.query_values)}, ${jsonInput(row.asset)}, ${jsonInput(row.shared)},
        ${row.revision}, ${jsonInput(row.native_sources)}, ${jsonInput(row.native_versions)}, ${row.record_lifetime})`;
      return;
    }
    for (const batch of jsonBatches(rows))
      yield sql`SELECT ${storageOwnerKey(owner)}, input.record_id, input.deleted, input.value, input.query_values, input.asset, input.shared, input.revision, input.native_sources, input.native_versions, input.record_lifetime
        FROM jsonb_to_recordset(${batch}::jsonb)
          AS input(record_id text, deleted boolean, value jsonb, query_values jsonb, asset jsonb, shared jsonb, revision text, native_sources jsonb, native_versions jsonb, record_lifetime text)`;
  };
  for (const input of inputs()) {
    const changed = await tx.execute(sql`
      INSERT INTO records (owner_id, record_id, deleted, value, query_values, asset, shared, revision, native_sources, native_versions, record_lifetime)
      ${input}
      ON CONFLICT (owner_id, record_id) DO UPDATE SET
        deleted = excluded.deleted, value = excluded.value,
        query_values = excluded.query_values || ${owner.extensionId === "pstdio" ? sql`CASE WHEN records.query_values ? ${identityQueryKey} THEN jsonb_build_object(${identityQueryKey}::text, records.query_values -> ${identityQueryKey}) ELSE '{}'::jsonb END` : sql`'{}'::jsonb`},
        asset = excluded.asset, shared = excluded.shared,
        revision = excluded.revision, native_sources = excluded.native_sources, native_versions = excluded.native_versions,
        record_lifetime = excluded.record_lifetime
      WHERE records.revision IS DISTINCT FROM excluded.revision OR records.record_lifetime <> excluded.record_lifetime
      RETURNING record_id
    `);
    projected += changed.rows.length;
  }
  return projected;
};
