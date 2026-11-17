import { and, eq, inArray, sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import {
  aggregateOptions,
  compareQueryValues,
  encodeQueryCursor,
  prepareRecordQuery,
  requestedRecordIndex,
  validateComputedConditions,
  validateIndexes,
  validatePredicate,
  validateRelatedQueryFields,
} from "pstdio-sync/records";
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
  storage_resource_projections,
} from "../../db/schemas.pg";
import { traceStorageQuery } from "./query-trace";
import { aggregateRecordQuery } from "./record-aggregate-query";
import { prepareDateFormatIndexes, pruneDateFormatIndexes, retainDateFormatIndexes } from "./record-date-format";
import { dependencyOrderedPageSql } from "./record-dependency-order";
import { derivedQueryChanges, rebuildDerivedQueryValues } from "./record-derived-fields";
import { formatCachePrefix, formatCacheSource } from "./record-format-key";
import { dropRecordIndexes, installRecordIndex, recordIndexName } from "./record-index-lifecycle";
import { decodeProjectionValue } from "./record-projection-codec";
import { pageAfterSql, recordPageSql, recordScopeSql } from "./record-query-sql";
import { loadRelatedQueryIndexes, relatedRecordPredicateSql } from "./record-related-query";
import { prepareTextOrder } from "./record-text-order";
import { identityQueryVersion, prepareResourceQueryValues } from "./resource-query-values";
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
    ...(row.record_lifetime ? { recordLifetime: row.record_lifetime } : {}),
    ...(Object.keys(row.native_sources).length
      ? { nativeSources: row.native_sources, nativeVersions: row.native_versions }
      : {}),
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

/** Conditional saves compare state under the owner lock without loading projected bodies. */
export const readProjectedRevisions = async (connection: Reader, owner: StorageOwner, ids: string[]) => {
  if (!ids.length) return [];
  const rows = await connection
    .select({ recordId: current.record_id, deleted: current.deleted, revision: current.revision })
    .from(current)
    .where(and(currentWhere(owner), inArray(current.record_id, ids)));
  const byId = new Map(rows.map((row) => [row.recordId, row]));
  return ids.map((id) => {
    const row = byId.get(id);
    return row
      ? { exists: true, deleted: row.deleted, revision: row.revision }
      : { exists: false, deleted: false, revision: "" };
  });
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

const emptyQueryResult = (owner: StorageOwner, revision: string, diagnostics?: StorageDiagnostics) => {
  diagnostics?.({ phase: "records-queried", owner, records: 0, materialized: 0 });
  return { revision, records: [], cursor: null };
};

const matchesRecordCatalog = (
  catalog: { name: string; databaseName: string }[],
  names: ReadonlyMap<string, string>,
) => {
  const declared = catalog.filter((row) => !formatCacheSource(row.name));
  return declared.length === names.size && declared.every((row) => row.databaseName === names.get(row.name));
};

export const createRecordQueries = (db: DbClient, owner: StorageOwner, diagnostics?: StorageDiagnostics) => {
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
  // Index replacement can change selection without editing records. Both belong to a query snapshot.
  const getRevision = async (connection: Reader, identities = false) => {
    let identityRevision = "";
    if (identities) {
      const [core] = await connection
        .select({ current: projections.revision, projected: storage_resource_projections.revision })
        .from(projections)
        .leftJoin(storage_resource_projections, eq(storage_resource_projections.workbench_id, projections.workbench_id))
        .where(and(eq(projections.workbench_id, owner.workbenchId), eq(projections.extension_id, "pstdio")));
      if (core && core.current !== (core.projected ?? 0))
        throw new Error("Resource identity projection is stale; upgrade before reading");
      identityRevision = `:${core?.projected ?? 0}:${identityQueryVersion}`;
    }
    const projection = connection
      .select({ revision: projections.revision })
      .from(projections)
      .where(ownerWhere(projections));
    const [row] = await connection
      .select({
        revision: sql<string>`coalesce((${projection}), 0)::text || ':' || md5(coalesce(string_agg(${indexes.database_name}, ',' ORDER BY ${indexes.database_name} COLLATE "C"), ''))`,
      })
      .from(indexes)
      .where(and(ownerWhere(indexes), sql`NOT starts_with(${indexes.name}, ${formatCachePrefix})`));
    return row.revision + identityRevision;
  };
  const api: StorageRecordQueries = {
    defineIndexes: async (definitions) => {
      traceStorageQuery("indexes-start", definitions.map(({ name }) => name).join(","));
      validateIndexes(definitions);
      const publicDesired = orderDefinitions(structuredClone(definitions));
      const names = new Map(
        await Promise.all(
          publicDesired.map(async (index) => [index.name, await recordIndexName(owner, index)] as const),
        ),
      );
      await db.transaction(async (tx) => {
        // The physical name hashes the complete definition and implementation version.
        // Check that exact catalog identity before hydrating definitions needed only for replacement.
        const catalog = await tx
          .select({ name: indexes.name, databaseName: indexes.database_name })
          .from(indexes)
          .where(ownerWhere(indexes));
        if (matchesRecordCatalog(catalog, names)) return;
        const previous = await tx.select().from(indexes).where(ownerWhere(indexes));
        const installed = orderDefinitions(
          decodeProjectionValue(
            previous.map((row) => row.definition) as unknown as Json,
          ) as unknown as StorageRecordIndex[],
        );
        const desired = orderDefinitions([
          ...publicDesired,
          ...(await retainDateFormatIndexes(installed, publicDesired)),
        ]);
        await dropRecordIndexes(tx, ownerWhere(indexes)!);
        await tx.delete(indexes).where(ownerWhere(indexes));
        await rebuildDerivedQueryValues(tx, owner, derivedQueryChanges(installed, desired), diagnostics);
        for (const index of desired) await installRecordIndex(tx, owner, index);
        // Expression indexes get planner statistics only from ANALYZE, not from CREATE INDEX.
        // Dropping indexes needs none, and analyzing the table shared by all owners is slow.
        if (desired.length) await tx.execute(sql`ANALYZE storage_current_records`);
      });
    },
    query: (query) =>
      db.transaction(async (tx) => {
        traceStorageQuery("query-start", query.index);
        validateRelatedQueryFields(query);
        const declared = await getIndex(tx, query.index);
        const index = requestedRecordIndex(declared, query);
        await prepareTextOrder(tx, index);
        await prepareDateFormatIndexes(tx, owner, declared, index, diagnostics);
        const related = await loadRelatedQueryIndexes(
          query.where,
          async (name) => {
            const declared = await getIndex(tx, name);
            const target = requestedRecordIndex(declared, query.related?.[name] ?? {});
            await prepareDateFormatIndexes(tx, owner, declared, target, diagnostics);
            return target;
          },
          index,
        );
        traceStorageQuery("query-metadata", query.index);
        await pruneDateFormatIndexes(tx, owner, related.definitions);
        if (related.hasIdentity) await prepareResourceQueryValues(tx, owner);
        const revision = await getRevision(tx, related.hasIdentity);
        traceStorageQuery("query-execute", query.index);
        const page = await prepareRecordQuery(owner, index, query, revision, related);
        if (page.limit === 0) return emptyQueryResult(owner, revision, diagnostics);
        const result = await tx.execute<QueryRow>(
          query.dependencyOrder
            ? dependencyOrderedPageSql(
                owner,
                index,
                query.dependencyOrder,
                page.fields,
                sql`${visible(index)} AND ${relatedRecordPredicateSql(owner, index, query.where, related)}`,
                page.limit,
                related,
              )
            : recordPageSql(
                index,
                page.fields,
                sql`${visible(index)} AND ${relatedRecordPredicateSql(owner, index, query.where, related)} AND ${pageAfterSql(index, page.after, related, owner)}`,
                // One extra row shows whether a next page exists without a second scan.
                page.limit + 1,
                page.offset,
                related,
                owner,
                query.orderBy === undefined || JSON.stringify(query.orderBy) === JSON.stringify(declared.orderBy)
                  ? query.where
                  : undefined,
              ),
        );
        const rows = result.rows.slice(0, page.limit);
        traceStorageQuery("query-complete", query.index);
        const last = rows.at(-1);
        const cursor =
          !query.dependencyOrder && last && result.rows.length > page.limit
            ? encodeQueryCursor({
                recordId: last.record_id,
                values: last.sort_values.map(decodeProjectionValue),
                identity: page.identity,
                revision,
              })
            : null;
        diagnostics?.({ phase: "records-queried", owner, records: rows.length, materialized: result.rows.length });
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
        traceStorageQuery("aggregate-start", query.index);
        validateRelatedQueryFields(query);
        const declared = await getIndex(tx, query.index);
        const index = requestedRecordIndex(declared, query);
        await prepareDateFormatIndexes(tx, owner, declared, index, diagnostics);
        aggregateOptions(index, query);
        const related = await loadRelatedQueryIndexes(
          query.where,
          async (name) => {
            const declared = await getIndex(tx, name);
            const target = requestedRecordIndex(declared, query.related?.[name] ?? {});
            await prepareDateFormatIndexes(tx, owner, declared, target, diagnostics);
            return target;
          },
          index,
        );
        traceStorageQuery("aggregate-metadata", query.index);
        await pruneDateFormatIndexes(tx, owner, related.definitions);
        if (related.hasIdentity) await prepareResourceQueryValues(tx, owner);
        const revision = await getRevision(tx, related.hasIdentity);
        traceStorageQuery("aggregate-execute", query.index);
        validatePredicate(index, query.where, 0, related);
        validateComputedConditions(index, related);
        if (
          query.where === undefined &&
          query.groupBy === undefined &&
          query.metrics === undefined &&
          query.statistics === undefined &&
          query.fingerprint === undefined &&
          index.prefix === undefined &&
          !index.identity
        ) {
          const [projection] = await tx.select().from(projections).where(ownerWhere(projections));
          return { revision, count: projection?.live_count ?? 0, groups: [] };
        }
        return aggregateRecordQuery(
          tx,
          index,
          query,
          revision,
          sql`${visible(index)} AND ${relatedRecordPredicateSql(owner, index, query.where, related)}`,
          related,
          owner,
        );
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
