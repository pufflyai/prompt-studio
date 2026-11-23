import { and, eq, sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import {
  aggregateOptions,
  encodeQueryCursor,
  prepareRecordQuery,
  requestedRecordIndex,
  validateComputedConditions,
  validatePredicate,
  validateRelatedQueryFields,
} from "pstdio-sync/records";
import type { Json, StorageRecordIndex, StorageRecordQueries, StorageRecordQuery } from "pstdio-sync-contracts";
import type { DbClient } from "../../db/connection.pglite";
import { type records as current, owners as projections } from "../../db/schemas.pg";
import { assertStorageOwnerAdmitted } from "../../db/storage-admission";
import { traceStorageQuery } from "./query-trace";
import { aggregateCacheEpochs, aggregateCacheFor } from "./record-aggregate-cache";
import { aggregateRecordQuery, canCountOwnerProjection } from "./record-aggregate-query";
import { countIndexSource } from "./record-count-query";
import { prepareDateFormatIndexes, pruneDateFormatIndexes } from "./record-date-format";
import { dependencyOrderedPageSql } from "./record-dependency-order";
import { formatDatabasePrefix } from "./record-format-key";
import { defineRecordIndexes } from "./record-index-definition";
import { recordIndexRows as indexes } from "./record-index-rows";
import { currentWhere, readProjectedRecords } from "./record-point-queries";
import { decodeProjectionValue } from "./record-projection-codec";
import { readQueryOwner } from "./record-query-owner";
import { pageAfterSql, recordPageSql } from "./record-query-sql";
import { recordVisibilitySql } from "./record-query-visibility";
import { loadRelatedQueryIndexes, relatedRecordPredicateSql } from "./record-related-query";
import { prepareTextOrder } from "./record-text-order";
import { identityQueryVersion, prepareResourceQueryValues } from "./resource-query-values";
import type { StorageDiagnostics } from "./storage-diagnostics";
import { storageOwnerKey } from "./storage-owner-key";

type QueryRow = { record_id: string; revision: string; fields: Record<string, Json>; sort_values: Json[] };
type Reader = Pick<DbClient, "select">;

export { listProjectedRecords, readProjectedRecords, readProjectedRevisions } from "./record-point-queries";

const emptyQueryResult = (owner: StorageOwner, revision: string, diagnostics?: StorageDiagnostics) => {
  diagnostics?.({ phase: "records-queried", owner, records: 0, materialized: 0 });
  return { revision, records: [], cursor: null };
};

const prepareQueryMetadata = async (
  db: DbClient,
  tx: Pick<DbClient, "select" | "execute" | "insert" | "delete">,
  owner: StorageOwner,
  query: StorageRecordQuery,
  getIndex: (connection: Reader, name: string) => Promise<StorageRecordIndex>,
  diagnostics?: StorageDiagnostics,
) => {
  validateRelatedQueryFields(query);
  const declared = await getIndex(tx, query.index);
  const index = requestedRecordIndex(declared, query);
  const revisionOnly = query.limit === 0;
  if (!revisionOnly) {
    await prepareTextOrder(tx, index);
    await prepareDateFormatIndexes(tx, owner, declared, index, diagnostics);
  }
  const related = await loadRelatedQueryIndexes(
    query.where,
    async (name) => {
      const declared = await getIndex(tx, name);
      const target = requestedRecordIndex(declared, query.related?.[name] ?? {});
      if (!revisionOnly) await prepareDateFormatIndexes(tx, owner, declared, target, diagnostics);
      return target;
    },
    index,
  );
  traceStorageQuery("query-metadata", query.index);
  if (related.hasIdentity) assertStorageOwnerAdmitted(db, { ...owner, extensionId: "pstdio" });
  if (!revisionOnly) {
    await pruneDateFormatIndexes(tx, owner, related.definitions);
    if (related.hasIdentity) await prepareResourceQueryValues(tx, owner);
  }
  return { declared, index, related };
};

export const createRecordQueries = (db: DbClient, owner: StorageOwner, diagnostics?: StorageDiagnostics) => {
  const ownerWhere = (table: typeof current | typeof indexes | typeof projections) => {
    if (table === indexes) return eq(indexes.owner_id, storageOwnerKey(owner));
    if (table === projections) return eq(projections.id, storageOwnerKey(owner));
    return currentWhere(owner);
  };
  const physicalNames = new WeakMap<StorageRecordIndex, string>();
  const aggregateCache = aggregateCacheFor(db);
  const getIndex = async (connection: Pick<DbClient, "select">, name: string) => {
    const [index] = await connection
      .select()
      .from(indexes)
      .where(
        and(
          ownerWhere(indexes),
          eq(indexes.name, name),
          sql`NOT starts_with(${indexes.database_name}, ${formatDatabasePrefix})`,
        ),
      );
    if (!index) throw new Error(`Storage index not installed: ${name}`);
    const declaration = decodeProjectionValue(index.definition as unknown as Json) as unknown as StorageRecordIndex;
    physicalNames.set(declaration, index.database_name);
    return declaration;
  };
  // Index replacement can change selection without editing records. Both belong to a query snapshot.
  const getRevision = async (connection: Reader, identities = false) => {
    let identityRevision = "";
    if (identities) {
      assertStorageOwnerAdmitted(db, { ...owner, extensionId: "pstdio" });
      const [core] = await connection
        .select({
          ownerId: projections.id,
          current: projections.revision,
          projected: projections.numbers_revision,
        })
        .from(projections)
        .where(eq(projections.id, storageOwnerKey({ ...owner, extensionId: "pstdio" })));
      if (core && core.current !== (core.projected ?? 0))
        throw new Error("Resource identity projection is stale; upgrade before reading");
      identityRevision = `:${core?.ownerId ?? 0}:${core?.projected ?? 0}:${identityQueryVersion}`;
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
      .where(and(ownerWhere(indexes), sql`NOT starts_with(${indexes.database_name}, ${formatDatabasePrefix})`));
    return row.revision + identityRevision;
  };
  const queryIn = async (tx: Parameters<Parameters<DbClient["transaction"]>[0]>[0], query: StorageRecordQuery) => {
    const queryOwner = await readQueryOwner(tx, owner);
    traceStorageQuery("query-start", query.index);
    const { declared, index, related } = await prepareQueryMetadata(db, tx, owner, query, getIndex, diagnostics);
    const revision = await getRevision(tx, related.hasIdentity);
    traceStorageQuery("query-execute", query.index);
    const page = await prepareRecordQuery(owner, index, query, revision, related);
    if (page.limit === 0) return emptyQueryResult(owner, revision, diagnostics);
    const visible = await recordVisibilitySql(queryOwner, index, declared, physicalNames.get(declared));
    const result = await tx.execute<QueryRow>(
      query.dependencyOrder
        ? dependencyOrderedPageSql(
            queryOwner,
            index,
            query.dependencyOrder,
            page.fields,
            sql`${visible} AND ${relatedRecordPredicateSql(queryOwner, index, query.where, related)}`,
            page.limit,
            related,
          )
        : recordPageSql(
            index,
            page.fields,
            sql`${visible} AND ${relatedRecordPredicateSql(queryOwner, index, query.where, related)} AND ${pageAfterSql(index, page.after, related, queryOwner)}`,
            // One extra row shows whether a next page exists without a second scan.
            page.limit + 1,
            page.offset,
            related,
            queryOwner,
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
  };
  const api: StorageRecordQueries = {
    defineIndexes: (definitions) => defineRecordIndexes(db, owner, definitions, "immediate", diagnostics),
    query: (query) => db.transaction((tx) => queryIn(tx, query)),
    aggregate: async (input) => {
      const query = structuredClone(input);
      let cacheKey: string | undefined;
      let reused = false;
      const result = await db.transaction(async (tx) => {
        const queryOwner = await readQueryOwner(tx, owner);
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
        if (related.hasIdentity) {
          assertStorageOwnerAdmitted(db, { ...owner, extensionId: "pstdio" });
          await prepareResourceQueryValues(tx, owner);
        }
        const revision = await getRevision(tx, related.hasIdentity);
        traceStorageQuery("aggregate-execute", query.index);
        validatePredicate(index, query.where, 0, related);
        validateComputedConditions(index, related);
        const epochs = await aggregateCacheEpochs(tx, owner, related.hasIdentity);
        cacheKey = epochs ? JSON.stringify([owner.workbenchId, owner.extensionId, epochs, revision, query]) : undefined;
        const cached = cacheKey ? aggregateCache.read(cacheKey) : undefined;
        if (cached) {
          reused = true;
          return cached;
        }
        if (canCountOwnerProjection(index, query)) {
          const [projection] = await tx.select().from(projections).where(ownerWhere(projections));
          return { revision, count: projection?.live_count ?? 0, groups: [] };
        }
        const predicate = relatedRecordPredicateSql(queryOwner, index, query.where, related);
        const name = physicalNames.get(declared);
        // An owner rename moves declarations before the new owner installs its count tables.
        const counted = await countIndexSource(tx, index, query, { name, declared, owner: queryOwner }, predicate);
        const visible = counted ? sql`true` : await recordVisibilitySql(queryOwner, index, declared, name);
        return aggregateRecordQuery(
          tx,
          index,
          query,
          revision,
          sql`${visible} AND ${predicate}`,
          related,
          queryOwner,
          counted,
        );
      });
      // Publish only after SQL accepts the snapshot; rolled-back reads never seed a shared cache.
      if (cacheKey && !reused) aggregateCache.remember(cacheKey, result);
      return result;
    },
    readMany: async (ids) => {
      if (ids.length > 100) throw new Error("A batch can read at most 100 records");
      return readProjectedRecords(db, owner, ids);
    },
  };
  return {
    ...api,
    queryIn,
  };
};
