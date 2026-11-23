import { sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import { assertStorageLimits } from "pstdio-sync-contracts";
import type { DbClient } from "../../db/connection.pglite";
import { jsonBatches } from "./json-batches";
import { type NativeProjectedRecord, projectNativeRecordText } from "./native-record-projection";
import type { stableRecordColumns } from "./ordered-record-row";
import { derivedQueryValues, readDerivedQueryIndexes } from "./record-derived-fields";
import { encodeProjectionValue } from "./record-projection-codec";
import { identityQueryKey } from "./resource-query-values";
import { storageOwnerKey } from "./storage-owner-key";

type Transaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];
type OrderedPublication = {
  facets: ReadonlyMap<string, ReturnType<typeof stableRecordColumns> & { base: Uint8Array | null }>;
  previous: ReadonlyMap<string, { revision: string | null; lifetime: string }>;
};

const jsonInput = (value: unknown) =>
  value === null || value === undefined ? sql`NULL::jsonb` : sql`${JSON.stringify(value)}::jsonb`;

/** Writes the query rows of saved records in their commit's transaction. Unchanged rows stay as they are. */
export const publishProjectedRecords = async (tx: Transaction, owner: StorageOwner, input: NativeProjectedRecord[]) => {
  const records = await Promise.all(input.map((record) => projectNativeRecordText(tx, owner, record)));
  assertStorageLimits(records);
  return writeProjectedRecords(tx, owner, records);
};

/** Already materialized records. Snapshot callers validate each record rather than one author group. */
export const writeProjectedRecords = async (
  tx: Transaction,
  owner: StorageOwner,
  records: NativeProjectedRecord[],
  ordered?: OrderedPublication,
) => {
  let projected = 0;
  const derived = await readDerivedQueryIndexes(tx, owner);
  const visibleChanges = new Set<string>();
  const rows = records.map((record) => {
    const facet = ordered?.facets.get(record.recordId);
    const lifetime = record.recordLifetime ?? "";
    const previous = ordered?.previous.get(record.recordId);
    if (!previous || previous.revision !== record.revision || previous.lifetime !== lifetime)
      visibleChanges.add(record.recordId);
    const deletedBody = record.deleted ? facet : undefined;
    return {
      record_id: record.recordId,
      deleted: record.deleted,
      value: deletedBody ? deletedBody.value : encodeProjectionValue(record.value),
      query_values: encodeProjectionValue(derivedQueryValues(derived, record)),
      asset: deletedBody ? deletedBody.asset : encodeProjectionValue(record.asset),
      shared: deletedBody ? deletedBody.shared : encodeProjectionValue(record.shared),
      revision: record.revision,
      native_sources: deletedBody
        ? deletedBody.native_sources
        : encodeProjectionValue((record.nativeSources ?? {}) as never),
      native_versions: record.nativeVersions ?? {},
      record_lifetime: lifetime,
      meta: facet?.meta ?? null,
      base: facet?.base ? Buffer.from(facet.base).toString("hex") : null,
    };
  });
  const inputs = function* () {
    if (rows.length === 1) {
      const row = rows[0]!;
      // An ordinary edit already has scalar fields. Avoid parsing a surrounding
      // JSON recordset only to unpack that one row again in Postgres.
      yield sql`VALUES (${storageOwnerKey(owner)}, ${row.record_id}, ${row.deleted},
        ${jsonInput(row.value)}, ${jsonInput(row.query_values)}, ${jsonInput(row.asset)}, ${jsonInput(row.shared)},
        ${row.revision}, ${jsonInput(row.native_sources)}, ${jsonInput(row.native_versions)}, ${row.record_lifetime},
        ${jsonInput(row.meta)}, decode(${row.base}::text, 'hex'))`;
      return;
    }
    for (const batch of jsonBatches(rows))
      yield sql`SELECT ${storageOwnerKey(owner)}, input.record_id, input.deleted, input.value, input.query_values, input.asset, input.shared, input.revision, input.native_sources, input.native_versions, input.record_lifetime, input.meta, decode(input.base,'hex')
        FROM jsonb_to_recordset(${batch}::jsonb)
          AS input(record_id text, deleted boolean, value jsonb, query_values jsonb, asset jsonb, shared jsonb, revision text, native_sources jsonb, native_versions jsonb, record_lifetime text, meta jsonb, base text)`;
  };
  const visibleChanged = sql`(records.revision IS DISTINCT FROM excluded.revision OR records.record_lifetime <> excluded.record_lifetime)`;
  const bodyChanged = ordered ? sql`(${visibleChanged} OR excluded.deleted)` : visibleChanged;
  const replace = (column: string, when = visibleChanged) =>
    sql`CASE WHEN ${when} THEN excluded.${sql.identifier(column)} ELSE records.${sql.identifier(column)} END`;
  for (const input of inputs()) {
    const changed = await tx.execute<{ record_id: string }>(sql`
      INSERT INTO records (owner_id, record_id, deleted, value, query_values, asset, shared, revision, native_sources, native_versions, record_lifetime, meta, base)
      ${input}
      ON CONFLICT (owner_id, record_id) DO UPDATE SET
        deleted = excluded.deleted, value = ${replace("value", bodyChanged)},
        query_values = CASE WHEN ${visibleChanged} THEN excluded.query_values || ${owner.extensionId === "pstdio" ? sql`CASE WHEN records.query_values ? ${identityQueryKey} THEN jsonb_build_object(${identityQueryKey}::text, records.query_values -> ${identityQueryKey}) ELSE '{}'::jsonb END` : sql`'{}'::jsonb`} ELSE records.query_values END,
        asset = ${replace("asset", bodyChanged)}, shared = ${replace("shared", bodyChanged)},
        revision = excluded.revision, native_sources = ${replace("native_sources", bodyChanged)}, native_versions = ${replace("native_versions")},
        record_lifetime = excluded.record_lifetime
        ${ordered ? sql`, meta = excluded.meta, base = excluded.base` : sql``}
      WHERE ${visibleChanged}
        ${
          ordered
            ? sql`OR records.meta IS DISTINCT FROM excluded.meta OR records.base IS DISTINCT FROM excluded.base
          OR (excluded.deleted AND (records.value, records.asset, records.shared, records.native_sources)
            IS DISTINCT FROM (excluded.value, excluded.asset, excluded.shared, excluded.native_sources))`
            : sql``
        }
      RETURNING record_id
    `);
    projected += ordered
      ? changed.rows.filter(({ record_id }) => visibleChanges.has(record_id)).length
      : changed.rows.length;
  }
  return projected;
};
