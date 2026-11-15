import { type SQL, sql } from "drizzle-orm";
import { canonicalJson, type StoragePredicate, type StorageRecordIndex } from "pstdio-sync-contracts";
import { encodeProjectionValue } from "./record-projection-codec";
import { createQueryFieldCache, queryFieldCacheSourceSql } from "./record-query-field-cache";
import { pageOrderSql, type QuerySqlOwner, recordEqualitySql, recordFieldSql } from "./record-query-sql";

const mandatory = (where?: StoragePredicate): StoragePredicate[] => {
  if (!where) return [];
  return "all" in where ? where.all.flatMap(mandatory) : [where];
};

/** Sort related scalar projections once before fetching complete records for the selected page. */
export const recordRelatedOrderCandidatesSql = (
  index: StorageRecordIndex,
  where: SQL,
  limit: number,
  offset: number,
  resolve: ((name: string) => StorageRecordIndex) | undefined,
  owner: QuerySqlOwner | undefined,
) => {
  if (!owner || !index.orderBy?.length) return;
  const cache = createQueryFieldCache(index);
  const order = pageOrderSql(cache.index, resolve, owner);
  if (
    ![...cache.fields.keys()].some(
      (name) =>
        index.fields[name].lookup ||
        name === index.identity?.shorthandField ||
        name === index.hierarchy?.breadcrumbField,
    )
  )
    return;
  const source = queryFieldCacheSourceSql(cache, where, (name) =>
    recordFieldSql(index, name, undefined, resolve, owner),
  );
  return sql`(SELECT record_id AS selected_record_id FROM ${source}
    ORDER BY ${order} LIMIT ${limit + offset}) AS candidates INNER JOIN storage_current_records
    ON storage_current_records.record_id = candidates.selected_record_id
    AND storage_current_records.workbench_id = ${owner.workbenchId}
    AND storage_current_records.extension_id = ${owner.extensionId}`;
};

/** Merge bounded ordered probes rather than walking the sort index until an IN
 * filter happens to match. Each branch must fix the entire equality prefix. */
export const recordCandidateSourceSql = (
  index: StorageRecordIndex,
  predicate: StoragePredicate | undefined,
  where: SQL,
  limit: number,
  offset: number,
  resolve: ((name: string) => StorageRecordIndex) | undefined,
  owner: QuerySqlOwner | undefined,
) => {
  if (!owner || !index.orderBy?.length || !index.equality?.length) return;
  const keys = index.equality;
  const predicates = mandatory(predicate);
  const selection = predicates.find(
    (predicate) => "field" in predicate && predicate.field === keys[0] && predicate.op === "in",
  );
  if (!selection || !("value" in selection) || !Array.isArray(selection.value) || !selection.value.length) return;
  if (
    !keys
      .slice(1)
      .every((key) =>
        predicates.some((predicate) => "field" in predicate && predicate.field === key && predicate.op === "eq"),
      )
  )
    return;
  const field = keys[0];
  if (
    index.fields[field].lookup ||
    index.identity?.shorthandField === field ||
    index.identity?.aliasesField === field ||
    index.hierarchy?.breadcrumbField === field
  )
    return;
  const values = [...new Map(selection.value.map((value) => [canonicalJson(value), value])).values()];
  // Deep offsets and large IN lists use the normal indexed SQL plan; a bounded
  // response must not expand into an unbounded intermediate merge per key.
  const candidatesPerKey = limit + offset;
  if (!Number.isSafeInteger(candidatesPerKey) || values.length * candidatesPerKey > 100_000) return;
  const encoded = sql`${JSON.stringify(encodeProjectionValue(values))}::jsonb`;
  const target = sql`coalesce(${recordFieldSql(index, field, undefined, resolve, owner)}, 'null'::jsonb)`;
  const probe = recordEqualitySql(index, field, target, sql`wanted.value`);
  return sql`(SELECT candidate.record_id AS selected_record_id FROM jsonb_array_elements(${encoded}) AS wanted(value)
    CROSS JOIN LATERAL (
      SELECT record_id FROM storage_current_records WHERE ${where} AND ${probe}
      ORDER BY ${pageOrderSql(index, resolve, owner)} LIMIT ${limit + offset}
    ) AS candidate) AS candidates INNER JOIN storage_current_records
      ON storage_current_records.record_id = candidates.selected_record_id
      AND storage_current_records.workbench_id = ${owner.workbenchId}
      AND storage_current_records.extension_id = ${owner.extensionId}`;
};
