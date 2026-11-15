import { type SQL, sql } from "drizzle-orm";
import { queryField } from "pstdio-sync/records";
import type { Json, StoragePredicate, StorageRecordIndex } from "pstdio-sync-contracts";
import { projectionKey } from "./record-projection-codec";
import { recordCandidateSourceSql, recordRelatedOrderCandidatesSql } from "./record-query-candidates";
import { createQueryFieldCache, queryFieldCacheSourceSql } from "./record-query-field-cache";
import { orderingPrefix, type QuerySqlOwner, recordFieldSql, sqlLiteral } from "./record-query-sql";
import { hasTextOrder, orderedFieldPartsSql, orderedValuePartsSql } from "./record-text-order";

export const pageOrderSql = (
  index: StorageRecordIndex,
  resolve?: (name: string) => StorageRecordIndex,
  owner?: QuerySqlOwner,
) =>
  sql.join(
    [
      ...(index.orderBy ?? []).flatMap((sort) => {
        const full = orderedFieldPartsSql(index, sort.field, undefined, resolve, owner).map(
          (field) => sql`${field} ${sql.raw(sort.direction)} NULLS LAST`,
        );
        return queryField(index, sort.field).type === "string" && !hasTextOrder(index, sort.field)
          ? [sql`${orderingPrefix(index, sort.field, resolve, owner)} ${sql.raw(sort.direction)} NULLS LAST`, ...full]
          : full;
      }),
      sql`record_id COLLATE "C" ASC`,
    ],
    sql`, `,
  );

export const recordPageSql = (
  index: StorageRecordIndex,
  fields: string[],
  where: SQL,
  limit: number,
  offset = 0,
  resolve?: (name: string) => StorageRecordIndex,
  owner?: QuerySqlOwner,
  predicate?: StoragePredicate,
) => {
  const candidates =
    recordCandidateSourceSql(index, predicate, where, limit, offset, resolve, owner) ??
    recordRelatedOrderCandidatesSql(index, where, limit, offset, resolve, owner);
  const original = index;
  const cache = candidates ? createQueryFieldCache(index) : undefined;
  if (cache) index = cache.index;
  const selected = fields.flatMap((name) => [
    sqlLiteral(projectionKey(name)),
    sql`coalesce(${recordFieldSql(index, name, undefined, resolve, owner)}, 'null'::jsonb)`,
  ]);
  const sort = (index.orderBy ?? []).map(
    (sort) => sql`coalesce(${recordFieldSql(index, sort.field, undefined, resolve, owner)}, 'null'::jsonb)`,
  );
  const order = pageOrderSql(index, resolve, owner);
  // Bound IDs before caching output leaves: deep offsets must not project every preceding row.
  const pageSource =
    candidates && owner
      ? sql`(SELECT record_id AS page_record_id FROM ${candidates}
        ORDER BY ${pageOrderSql(original, resolve, owner)} LIMIT ${limit} OFFSET ${offset}) AS page
        INNER JOIN storage_current_records ON storage_current_records.record_id = page.page_record_id
        AND storage_current_records.workbench_id = ${owner.workbenchId}
        AND storage_current_records.extension_id = ${owner.extensionId}`
      : undefined;
  const source =
    cache?.fields.size && pageSource
      ? queryFieldCacheSourceSql(
          cache,
          sql`true`,
          (name) => recordFieldSql(original, name, undefined, resolve, owner),
          pageSource,
        )
      : undefined;
  return sql`
    SELECT record_id, revision,
      jsonb_build_object(${sql.join(selected, sql`, `)}) AS fields,
      jsonb_build_array(${sql.join(sort, sql`, `)}) AS sort_values
    FROM ${source ?? candidates ?? sql`storage_current_records`}
    ${candidates ? sql`` : sql`WHERE ${where}`}
    ORDER BY ${order} LIMIT ${limit} OFFSET ${source ? 0 : offset}`;
};

export const pageAfterSql = (
  index: StorageRecordIndex,
  after?: { recordId: string; values: Json[] },
  resolve?: (name: string) => StorageRecordIndex,
  owner?: QuerySqlOwner,
) => {
  if (!after) return sql`true`;
  const equal: SQL[] = [];
  const alternatives: SQL[] = [];
  for (const [position, sort] of (index.orderBy ?? []).entries()) {
    const fields = orderedFieldPartsSql(index, sort.field, undefined, resolve, owner);
    const values = orderedValuePartsSql(index, sort.field, after.values[position]);
    for (const [i, field] of fields.entries()) {
      const value = values[i];
      if (value !== null) {
        const direction = sort.direction === "asc" ? sql`>` : sql`<`;
        alternatives.push(
          sql`(${sql.join([...equal, sql`(${field} ${direction} ${value} OR ${field} IS NULL)`], sql` AND `)})`,
        );
      }
      equal.push(sql`${field} IS NOT DISTINCT FROM ${value ?? sql`NULL`}`);
    }
  }
  alternatives.push(sql`(${sql.join([...equal, sql`record_id COLLATE "C" > ${after.recordId}`], sql` AND `)})`);
  return sql`(${sql.join(alternatives, sql` OR `)})`;
};
