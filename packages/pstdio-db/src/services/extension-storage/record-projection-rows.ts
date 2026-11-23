import { sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import { assertStorageLimits } from "pstdio-sync-contracts";
import type { DbClient } from "../../db/connection.pglite";
import { jsonBatches } from "./json-batches";
import { type NativeProjectedRecord, projectNativeRecordText } from "./native-record-projection";
import type { orderedProjectionFacets } from "./ordered-record-publication";
import { derivedQueryValues, readDerivedQueryIndexes } from "./record-derived-fields";
import { encodeProjectionValue } from "./record-projection-codec";
import { identityQueryKey } from "./resource-query-values";
import { storageOwnerKey } from "./storage-owner-key";

type Transaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];
type OrderedFacets = Awaited<ReturnType<typeof orderedProjectionFacets>>;

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
  facets?: OrderedFacets,
) => {
  let projected = 0;
  const derived = await readDerivedQueryIndexes(tx, owner);
  const rows = records.map((record) => {
    const facet = facets?.get(record.recordId);
    const deletedBody = facet?.body;
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
      record_lifetime: record.recordLifetime ?? "",
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
  const published = facets ? new Set<string>() : undefined;
  for (const input of inputs()) {
    const changed = await tx.execute<{ record_id: string }>(sql`
      INSERT INTO records (owner_id, record_id, deleted, value, query_values, asset, shared, revision, native_sources, native_versions, record_lifetime, meta, base)
      ${input}
      ON CONFLICT (owner_id, record_id) DO UPDATE SET
        deleted = excluded.deleted, value = excluded.value,
        query_values = excluded.query_values || ${owner.extensionId === "pstdio" ? sql`CASE WHEN records.query_values ? ${identityQueryKey} THEN jsonb_build_object(${identityQueryKey}::text, records.query_values -> ${identityQueryKey}) ELSE '{}'::jsonb END` : sql`'{}'::jsonb`},
        asset = excluded.asset, shared = excluded.shared, revision = excluded.revision,
        native_sources = excluded.native_sources, native_versions = excluded.native_versions,
        record_lifetime = excluded.record_lifetime
        ${facets ? sql`, meta = excluded.meta, base = excluded.base` : sql``}
      WHERE records.revision IS DISTINCT FROM excluded.revision OR records.record_lifetime <> excluded.record_lifetime
      RETURNING record_id
    `);
    projected += changed.rows.length;
    for (const { record_id } of changed.rows) published?.add(record_id);
  }
  // A confirmation may advance the saved base while leaving the same visible revision.
  // Its private facets still need publication. It must not advance the owner revision.
  if (published && projected !== rows.length) {
    const unchanged = rows
      .filter(({ record_id }) => !published.has(record_id))
      .map(({ record_id, deleted, value, asset, shared, native_sources, meta, base }) => ({
        record_id,
        deleted,
        value,
        asset,
        shared,
        native_sources,
        meta,
        base,
      }));
    for (const batch of jsonBatches(unchanged))
      await tx.execute(sql`UPDATE records target SET meta=input.meta,base=decode(input.base,'hex'),
        value=CASE WHEN input.deleted THEN input.value ELSE target.value END,
        asset=CASE WHEN input.deleted THEN input.asset ELSE target.asset END,
        shared=CASE WHEN input.deleted THEN input.shared ELSE target.shared END,
        native_sources=CASE WHEN input.deleted THEN input.native_sources ELSE target.native_sources END
        FROM jsonb_to_recordset(${batch}::jsonb) AS input(record_id text,deleted boolean,value jsonb,asset jsonb,shared jsonb,native_sources jsonb,meta jsonb,base text)
        WHERE target.owner_id=${storageOwnerKey(owner)} AND target.record_id=input.record_id
          AND (target.meta IS DISTINCT FROM input.meta OR target.base IS DISTINCT FROM decode(input.base,'hex')
            OR (input.deleted AND (target.value,target.asset,target.shared,target.native_sources)
              IS DISTINCT FROM (input.value,input.asset,input.shared,input.native_sources)))`);
  }
  return projected;
};
