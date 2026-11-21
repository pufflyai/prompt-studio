import { type SQL, sql } from "drizzle-orm";
import { queryField } from "pstdio-sync/records";
import type { Json, StoragePredicate, StorageRecordIndex } from "pstdio-sync-contracts";
import { recordIdentityPrefixSql } from "./record-identity-order";
import { recordPrefixCandidatesSql } from "./record-prefix-candidates";
import { projectionKey } from "./record-projection-codec";
import { recordCandidateSourceSql, recordRelatedOrderCandidatesSql } from "./record-query-candidates";
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
  const selected = fields.flatMap((name) => [
    sqlLiteral(projectionKey(name)),
    sql`coalesce(${recordFieldSql(index, name, undefined, resolve, owner)}, 'null'::jsonb)`,
  ]);
  const sort = (index.orderBy ?? []).map(
    (sort) => sql`coalesce(${recordFieldSql(index, sort.field, undefined, resolve, owner)}, 'null'::jsonb)`,
  );
  const candidates =
    recordPrefixCandidatesSql(index, where, limit, offset, owner) ??
    recordCandidateSourceSql(index, predicate, where, limit, offset, resolve, owner) ??
    recordRelatedOrderCandidatesSql(index, where, limit, offset, resolve, owner);
  return sql`
    SELECT record_id, revision,
      jsonb_build_object(${sql.join(selected, sql`, `)}) AS fields,
      jsonb_build_array(${sql.join(sort, sql`, `)}) AS sort_values
    FROM ${candidates ?? sql`storage_current_records`}
    ${candidates ? sql`` : sql`WHERE ${where}`}
    ORDER BY ${pageOrderSql(index, resolve, owner)} LIMIT ${limit} OFFSET ${offset}`;
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
