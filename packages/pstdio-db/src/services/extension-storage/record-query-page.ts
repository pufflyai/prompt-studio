import { type SQL, sql } from "drizzle-orm";
import { queryField } from "pstdio-sync/records";
import type { Json, StoragePredicate, StorageRecordIndex } from "pstdio-sync-contracts";
import { recordIdentityPrefixSql } from "./record-identity-order";
import { recordPrefixCandidatesSql } from "./record-prefix-candidates";
import { projectionKey } from "./record-projection-codec";
import { recordCandidateSourceSql, recordRelatedOrderCandidatesSql } from "./record-query-candidates";
import { createQueryFieldCache, queryFieldCacheSourceSql } from "./record-query-field-cache";
import { orderingPrefix, type QuerySqlOwner, queryOwnerKey, recordFieldSql, sqlLiteral } from "./record-query-sql";
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
      sql`${recordIdentityPrefixSql()} ASC`,
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
  const original = index;
  const candidates =
    recordPrefixCandidatesSql(index, where, limit, offset, owner) ??
    recordCandidateSourceSql(index, predicate, where, limit, offset, resolve, owner);
  const orderedCandidates = candidates
    ? undefined
    : recordRelatedOrderCandidatesSql(index, where, limit, offset, resolve, owner);
  const sourceCandidates = candidates ?? orderedCandidates;
  const selectedOrder = orderedCandidates ? sql`candidates.selected_order` : pageOrderSql(original, resolve, owner);
  const complex = fields.some((name) => {
    const field = queryField(index, name);
    return field.lookup || field.expression || field.cases || name === index.hierarchy?.breadcrumbField;
  });
  const cache =
    complex && owner
      ? createQueryFieldCache(index, [...fields, ...(index.orderBy ?? []).map(({ field }) => field)])
      : undefined;
  if (cache) index = cache.index;
  const selected = fields.flatMap((name) => [
    sqlLiteral(projectionKey(name)),
    sql`coalesce(${recordFieldSql(index, name, undefined, resolve, owner)}, 'null'::jsonb)`,
  ]);
  const sort = (index.orderBy ?? []).map(
    (sort) => sql`coalesce(${recordFieldSql(index, sort.field, undefined, resolve, owner)}, 'null'::jsonb)`,
  );
  const order = pageOrderSql(index, resolve, owner);
  if (cache && (cache.fields.size || cache.predicates.size) && owner) {
    // Select the bounded page first. Materialize only its projected leaves once,
    // so computed fields reuse related lookups instead of expanding them repeatedly.
    const page = sql`(SELECT record_id AS selected_record_id FROM ${sourceCandidates ?? sql`records`}
      ${sourceCandidates ? sql`` : sql`WHERE ${where}`}
      ORDER BY ${selectedOrder} LIMIT ${limit} OFFSET ${offset}) AS selected
      INNER JOIN records ON records.record_id = selected.selected_record_id AND records.owner_id = ${queryOwnerKey(owner)}`;
    const source = queryFieldCacheSourceSql(
      cache,
      sql`true`,
      (name) => recordFieldSql(original, name, undefined, resolve, owner),
      page,
    );
    return sql`SELECT record_id, revision, jsonb_build_object(${sql.join(selected, sql`, `)}) AS fields,
      jsonb_build_array(${sql.join(sort, sql`, `)}) AS sort_values FROM ${source} ORDER BY ${order}`;
  }
  return sql`
    SELECT record_id, revision,
      jsonb_build_object(${sql.join(selected, sql`, `)}) AS fields,
      jsonb_build_array(${sql.join(sort, sql`, `)}) AS sort_values
    FROM ${sourceCandidates ?? sql`records`}
    ${sourceCandidates ? sql`` : sql`WHERE ${where}`}
    ORDER BY ${order} LIMIT ${limit} OFFSET ${offset}`;
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
  alternatives.push(
    sql`(${sql.join(
      [
        ...equal,
        sql`${recordIdentityPrefixSql()} >= ${recordIdentityPrefixSql(sql`${after.recordId}::text`)}`,
        sql`record_id COLLATE "C" > ${after.recordId}`,
      ],
      sql` AND `,
    )})`,
  );
  return sql`(${sql.join(alternatives, sql` OR `)})`;
};
