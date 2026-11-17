import { type SQL, sql } from "drizzle-orm";
import { aggregateOptions, compareAggregateGroups } from "pstdio-sync/records";
import type { Json, StorageAggregateQuery, StorageRecordIndex } from "pstdio-sync-contracts";
import type { DbClient } from "../../db/connection.pglite";
import { decodeProjectionValue, projectionKey } from "./record-projection-codec";
import { recordFieldSql } from "./record-query-sql";

export const aggregateRecordQuery = async (
  tx: Pick<DbClient, "execute">,
  index: StorageRecordIndex,
  query: StorageAggregateQuery,
  revision: string,
  where: SQL,
) => {
  const options = aggregateOptions(index, query);
  const metrics = options.metrics.length
    ? sql`jsonb_build_object(${sql.join(
        options.metrics.flatMap(([name, metric]) => {
          const field = sql`(${recordFieldSql(index, metric.field)} #>> '{}')::numeric`;
          const value = sql`${sql.raw(metric.operation)}(${field})`;
          return [sql`${projectionKey(name)}::text`, metric.operation === "sum" ? sql`coalesce(${value}, 0)` : value];
        }),
        sql`, `,
      )})`
    : sql`NULL::jsonb`;
  type AggregateRow = { count: string; metrics: Record<string, number | null> | null; value?: Json };
  const totals = await tx.execute<AggregateRow>(sql`SELECT count(*)::text AS count, ${metrics} AS metrics
    FROM storage_current_records WHERE ${where}`);
  const total = totals.rows[0];
  const resultMetrics = (row: AggregateRow) => {
    if (query.metrics === undefined) return {};
    const values = decodeProjectionValue(row.metrics ?? {}) as Record<string, number | null>;
    if (Object.values(values).some((value) => value !== null && !Number.isFinite(value)))
      throw new Error("Aggregate number exceeds the finite JavaScript range");
    return { metrics: values };
  };
  if (!options.groupBy.length) return { revision, count: Number(total.count), groups: [], ...resultMetrics(total) };
  const fields = options.groupBy.map((field) => sql`coalesce(${recordFieldSql(index, field)}, 'null'::jsonb)`);
  const group = typeof query.groupBy === "string" ? fields[0] : sql`jsonb_build_array(${sql.join(fields, sql`, `)})`;
  const grouped =
    await tx.execute<AggregateRow>(sql`SELECT ${group} AS value, count(*)::text AS count, ${metrics} AS metrics
    FROM storage_current_records WHERE ${where} GROUP BY 1 ${options.groupLimit === undefined ? sql`` : sql`LIMIT ${options.groupLimit + 1}`}`);
  if (options.groupLimit !== undefined && grouped.rows.length > options.groupLimit)
    throw new Error(`Aggregate has more than ${options.groupLimit} groups; narrow its selection`);
  return {
    revision,
    count: Number(total.count),
    ...resultMetrics(total),
    groups: grouped.rows
      .map((row) => ({
        value: decodeProjectionValue(row.value ?? null),
        count: Number(row.count),
        ...resultMetrics(row),
      }))
      .sort((a, b) => compareAggregateGroups(query, a.value, b.value)),
  };
};
