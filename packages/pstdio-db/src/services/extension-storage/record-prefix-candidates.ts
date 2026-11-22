import { type SQL, sql } from "drizzle-orm";
import type { StorageRecordIndex } from "pstdio-sync-contracts";
import { recordIdentityPrefixBytes } from "./record-identity-order";
import {
  pageOrderSql,
  type QuerySqlOwner,
  queryOwnerKey,
  recordIndexKeys,
  recordScopeSql,
  sortFieldSql,
} from "./record-query-sql";
import { hasTextOrder } from "./record-text-order";

/** Probe an installed alternate ordering before expensive computed filters influence
 * the plan. Truncated string keys are safe only when every selected value is short;
 * otherwise retain the full canonical ordering and all prefix-collision semantics. */
export const recordPrefixCandidatesSql = (
  index: StorageRecordIndex,
  where: SQL,
  limit: number,
  offset: number,
  owner: QuerySqlOwner | undefined,
) => {
  const orderBy = index.orderBy ?? [];
  const identityOnly = orderBy.length === 0;
  const probeLimit = (limit + offset) * (identityOnly ? 1 : 2);
  if (!owner || probeLimit > 100_000) return;
  if (!identityOnly && !index.alternateOrders?.some((order) => JSON.stringify(order) === JSON.stringify(orderBy)))
    return;
  const strings = orderBy.filter(({ field }) => index.fields[field].type === "string");
  if (!identityOnly && !strings.length) return;
  if (
    orderBy.some(({ field: name }) => {
      const field = index.fields[name];
      return (
        field.lookup ||
        field.expression ||
        field.cases ||
        field.format ||
        hasTextOrder(index, name) ||
        name === index.identity?.shorthandField ||
        name === index.identity?.aliasesField ||
        name === index.hierarchy?.breadcrumbField
      );
    })
  )
    return;
  const safe = sql.join(
    [
      sql`octet_length(record_id) <= ${recordIdentityPrefixBytes}`,
      ...strings.map(
        ({ field }) =>
          sql`coalesce(octet_length(${sortFieldSql(index, field)}) < ${Math.max(1, Math.floor(1024 / orderBy.length))}, true)`,
      ),
    ],
    sql` AND `,
  );
  const scope = recordScopeSql(owner, { ...index, identity: undefined });
  const order = sql.join(recordIndexKeys({ ...index, equality: [] }), sql`, `);
  return sql`(
    WITH ordered_probe AS MATERIALIZED (
      SELECT * FROM storage_current_records WHERE ${scope} ORDER BY ${order} LIMIT ${probeLimit}
    ), selected AS MATERIALIZED (
      SELECT record_id FROM ordered_probe AS storage_current_records WHERE ${where}
    ), unsafe AS MATERIALIZED (
      SELECT 1 WHERE (SELECT count(*) FROM selected) < ${limit + offset}
        OR EXISTS (SELECT 1 FROM ordered_probe AS storage_current_records WHERE NOT (${safe}))
    )
    SELECT record_id AS selected_record_id FROM selected WHERE NOT EXISTS (SELECT 1 FROM unsafe)
    UNION ALL
    SELECT record_id AS selected_record_id FROM (
      SELECT record_id FROM storage_current_records WHERE EXISTS (SELECT 1 FROM unsafe) AND ${where}
      ORDER BY ${pageOrderSql(index)} LIMIT ${limit + offset}
    ) AS fallback
  ) AS candidates CROSS JOIN LATERAL (
    SELECT * FROM storage_current_records WHERE storage_current_records.record_id = candidates.selected_record_id
    AND storage_current_records.owner_id = ${queryOwnerKey(owner)} OFFSET 0
  ) AS storage_current_records`;
};
