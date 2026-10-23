import { and, eq, inArray, sql } from "drizzle-orm";
import {
  compareQueryValues,
  encodeQueryCursor,
  prepareRecordQuery,
  type StorageOwner,
  validateIndexes,
  validatePredicate,
} from "pstdio-sync";
import {
  fingerprint,
  type Json,
  type StorageRecord,
  type StorageRecordIndex,
  type StorageRecordQueries,
} from "pstdio-sync-contracts";
import type { DbClient } from "../../db/connection.pglite";
import {
  storage_current_records as current,
  storage_record_indexes as indexes,
  storage_record_projections as projections,
} from "../../db/schemas.pg";
import { dropRecordIndexes } from "./record-index-lifecycle";
import { decodeProjectionValue, encodeProjectionValue } from "./record-projection-codec";
import {
  arrayIndexFields,
  pageAfterSql,
  predicateSql,
  recordFieldSql,
  recordIndexKeys,
  recordPageSql,
  recordScopeSql,
} from "./record-query-sql";
import type { StorageDiagnostics } from "./storage-diagnostics";

type QueryRow = { record_id: string; revision: string; fields: Record<string, Json>; sort_values: Json[] };
type Current = typeof current.$inferSelect;
const orderDefinitions = (definitions: StorageRecordIndex[]) =>
  definitions.sort((left, right) => compareQueryValues(left.name, right.name));
const missingRecord = async (recordId: string) => ({
  recordId,
  exists: false,
  deleted: false,
  value: null,
  asset: null,
  shared: null,
  revision: await fingerprint({ value: null, asset: null, shared: null, deleted: false }),
});
const asRecord = (row: Current) =>
  ({
    recordId: row.record_id,
    exists: true,
    deleted: row.deleted,
    value: decodeProjectionValue(row.value ?? null),
    asset: decodeProjectionValue(row.asset) as StorageRecord["asset"],
    shared: decodeProjectionValue(row.shared) as StorageRecord["shared"],
    revision: row.revision,
  }) satisfies StorageRecord;

type Reader = Pick<DbClient, "select">;
const currentWhere = (owner: StorageOwner) =>
  and(eq(current.workbench_id, owner.workbenchId), eq(current.extension_id, owner.extensionId));

/** Point reads come from the projection; a missing row is a record that was never saved. */
export const readProjectedRecords = async (connection: Reader, owner: StorageOwner, ids: string[]) => {
  if (!ids.length) return [];
  const rows = await connection
    .select()
    .from(current)
    .where(and(currentWhere(owner), inArray(current.record_id, ids)));
  const byId = new Map(rows.map((row) => [row.record_id, asRecord(row)]));
  return Promise.all(ids.map((id) => byId.get(id) ?? missingRecord(id)));
};

/** Live records under an address prefix, in UTF-16 record ID order like the in-memory storage. */
export const listProjectedRecords = async (connection: Reader, owner: StorageOwner, prefix = "") =>
  (
    await connection
      .select()
      .from(current)
      .where(and(currentWhere(owner), eq(current.deleted, false), sql`starts_with(${current.record_id}, ${prefix})`))
  )
    .map(asRecord)
    .sort((left, right) => {
      if (left.recordId === right.recordId) return 0;
      return left.recordId < right.recordId ? -1 : 1;
    });

export const createRecordQueries = (
  db: DbClient,
  owner: StorageOwner,
  /** Moves records out of an old owner document before indexes are built. */
  upgrade: () => Promise<void>,
  diagnostics?: StorageDiagnostics,
) => {
  const address = { workbench_id: owner.workbenchId, extension_id: owner.extensionId };
  const ownerWhere = (table: typeof current | typeof indexes | typeof projections) =>
    and(eq(table.workbench_id, owner.workbenchId), eq(table.extension_id, owner.extensionId));
  const visible = (index: StorageRecordIndex) => recordScopeSql(owner, index);
  const getIndex = async (connection: Pick<DbClient, "select">, name: string) => {
    const [index] = await connection
      .select()
      .from(indexes)
      .where(and(ownerWhere(indexes), eq(indexes.name, name)));
    if (!index) throw new Error(`Storage index not installed: ${name}`);
    return decodeProjectionValue(index.definition as unknown as Json) as unknown as StorageRecordIndex;
  };
  // The projection row is the owner's revision; an owner without one has no records yet.
  const getRevision = async (connection: Reader) => {
    const [projection] = await connection.select().from(projections).where(ownerWhere(projections));
    return String(projection?.revision ?? 0);
  };
  const api: StorageRecordQueries = {
    defineIndexes: async (definitions) => {
      validateIndexes(definitions);
      const desired = orderDefinitions(structuredClone(definitions));
      const previous = await db.select().from(indexes).where(ownerWhere(indexes));
      const installed = orderDefinitions(
        decodeProjectionValue(
          previous.map((row) => row.definition) as unknown as Json,
        ) as unknown as StorageRecordIndex[],
      );
      const [ready] = await db.select().from(projections).where(ownerWhere(projections));
      if (
        ready &&
        (await fingerprint(installed as unknown as Json)) === (await fingerprint(desired as unknown as Json))
      )
        return;
      await upgrade();
      await db.transaction(async (tx) => {
        await dropRecordIndexes(tx, ownerWhere(indexes)!);
        await tx.delete(indexes).where(ownerWhere(indexes));
        for (const index of desired) {
          const name = `storage_query_${(await fingerprint({ owner: { ...owner }, definition: index as unknown as Json })).slice(0, 32)}`;
          const keys = recordIndexKeys(index);
          await tx.execute(
            sql`CREATE INDEX ${sql.identifier(name)} ON storage_current_records (${sql.join(keys, sql`, `)}) WHERE ${visible(index)}`,
          );
          // Postgres ignores partial-index statistics when estimating rows. Without these,
          // an in-list looks like half the owner and the planner scans every row.
          for (const [position, key] of keys.slice(0, index.equality?.length ?? 0).entries())
            await tx.execute(
              sql`CREATE STATISTICS ${sql.identifier(`${name}_s${position}`)} ON ${key} FROM storage_current_records`,
            );
          for (const [position, [field]] of arrayIndexFields(index).entries())
            await tx.execute(
              sql`CREATE INDEX ${sql.identifier(`${name}_g${position}`)} ON storage_current_records USING gin ((${recordFieldSql(index, field)})) WHERE ${visible(index)}`,
            );
          await tx.insert(indexes).values({
            ...address,
            name: index.name,
            database_name: name,
            definition: encodeProjectionValue(index as unknown as Json) as unknown as StorageRecordIndex,
          });
        }
        // Expression indexes get planner statistics only from ANALYZE, not from CREATE INDEX.
        await tx.execute(sql`ANALYZE storage_current_records`);
      });
    },
    query: (query) =>
      db.transaction(async (tx) => {
        const index = await getIndex(tx, query.index);
        const revision = await getRevision(tx);
        const page = await prepareRecordQuery(owner, index, query, revision);
        const result = await tx.execute<QueryRow>(
          recordPageSql(
            index,
            page.fields,
            sql`${visible(index)} AND ${predicateSql(index, query.where)} AND ${pageAfterSql(index, page.after)}`,
            // One extra row shows whether a next page exists without a second scan.
            page.limit + 1,
            page.offset,
          ),
        );
        const rows = result.rows.slice(0, page.limit);
        const last = rows.at(-1);
        const cursor =
          last && result.rows.length > page.limit
            ? encodeQueryCursor({
                recordId: last.record_id,
                values: last.sort_values.map(decodeProjectionValue),
                identity: page.identity,
                revision,
              })
            : null;
        diagnostics?.({ phase: "records-queried", owner, records: rows.length });
        return {
          revision,
          cursor,
          records: rows.map((row) => ({
            recordId: row.record_id,
            revision: row.revision,
            fields: decodeProjectionValue(row.fields) as Record<string, Json>,
          })),
        };
      }),
    aggregate: (query) =>
      db.transaction(async (tx) => {
        const index = await getIndex(tx, query.index);
        const revision = await getRevision(tx);
        validatePredicate(index, query.where);
        const group =
          query.groupBy === undefined
            ? sql`NULL::jsonb`
            : sql`coalesce(${recordFieldSql(index, query.groupBy)}, 'null'::jsonb)`;
        const result = await tx.execute<{ value: Json; count: string }>(
          sql`SELECT ${group} AS value, count(*)::text AS count FROM storage_current_records WHERE ${visible(index)} AND ${predicateSql(index, query.where)} GROUP BY 1`,
        );
        return {
          revision,
          count: result.rows.reduce((sum, row) => sum + Number(row.count), 0),
          groups:
            query.groupBy === undefined
              ? []
              : result.rows
                  .map((row) => ({ value: decodeProjectionValue(row.value ?? null), count: Number(row.count) }))
                  .sort((a, b) => compareQueryValues(a.value, b.value)),
        };
      }),
    readMany: async (ids) => {
      if (ids.length > 100) throw new Error("A batch can read at most 100 records");
      return readProjectedRecords(db, owner, ids);
    },
  };
  return {
    ...api,
    hasProjection: async () => (await db.select().from(projections).where(ownerWhere(projections))).length > 0,
  };
};
