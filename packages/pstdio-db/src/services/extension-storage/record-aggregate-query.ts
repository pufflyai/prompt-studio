import { type SQL, sql } from "drizzle-orm";
import { aggregateOptions, compareAggregateGroups } from "pstdio-sync/records";
import type { Json, StorageAggregateQuery, StorageRecordIndex } from "pstdio-sync-contracts";
import type { DbClient } from "../../db/connection.pglite";
import { createLookupSetIndex } from "./record-lookup-set";
import { decodeProjectionValue, projectionKey } from "./record-projection-codec";
import { createQueryFieldCache, queryFieldCacheSourceSql } from "./record-query-field-cache";
import { type QuerySqlOwner, recordFieldSql } from "./record-query-sql";
import { aggregateRecordStatistics } from "./record-statistics";

export const aggregateRecordQuery = async (
  tx: Pick<DbClient, "execute">,
  index: StorageRecordIndex,
  query: StorageAggregateQuery,
  revision: string,
  where: SQL,
  resolve?: (name: string) => StorageRecordIndex,
  owner?: QuerySqlOwner,
  counted?: SQL,
) => {
  const options = aggregateOptions(index, query);
  index = createLookupSetIndex(index, owner, query.where);
  const statistics = query.statistics
    ? { statistics: await aggregateRecordStatistics(tx, index, query, where, resolve, owner) }
    : {};
  const original = index;
  const cache =
    options.metrics.length > 1
      ? createQueryFieldCache(index, [
          ...options.groupBy,
          ...options.metrics.map(([, metric]) => metric.field),
          ...(query.fingerprint ?? []),
        ])
      : undefined;
  if (cache) index = cache.index;
  const cardinality = counted ? sql`coalesce(sum(n), 0)` : sql`count(*)`;
  const source = () => {
    if (counted) return counted;
    if (!cache || (!cache.fields.size && !cache.predicates.size)) return sql`records WHERE ${where}`;
    return queryFieldCacheSourceSql(cache, where, (name) => recordFieldSql(original, name, undefined, resolve, owner));
  };
  const metrics = options.metrics.length
    ? sql`jsonb_build_object(${sql.join(
        options.metrics.flatMap(([name, metric]) => {
          const field = sql`(${recordFieldSql(index, metric.field, undefined, resolve, owner)} #>> '{}')::numeric`;
          const value = sql`${sql.raw(metric.operation)}(${field})`;
          return [sql`${projectionKey(name)}::text`, metric.operation === "sum" ? sql`coalesce(${value}, 0)` : value];
        }),
        sql`, `,
      )})`
    : sql`NULL::jsonb`;
  const digest = query.fingerprint
    ? sql`md5(coalesce(string_agg(md5(jsonb_build_array(record_id, ${sql.join(
        query.fingerprint.map(
          (field) => sql`coalesce(${recordFieldSql(index, field, undefined, resolve, owner)}, 'null'::jsonb)`,
        ),
        sql`, `,
      )})::text), '' ORDER BY record_id COLLATE "C"), ''))`
    : sql`NULL::text`;
  type AggregateRow = {
    count: string;
    metrics: Record<string, number | null> | null;
    fingerprint: string | null;
    value?: Json;
    total_count?: string;
    total_metrics?: Record<string, number | null> | null;
  };
  const resultMetrics = (row: AggregateRow) => {
    if (query.metrics === undefined) return {};
    const values = decodeProjectionValue(row.metrics ?? {}) as Record<string, number | null>;
    if (Object.values(values).some((value) => value !== null && !Number.isFinite(value)))
      throw new Error("Aggregate number exceeds the finite JavaScript range");
    return { metrics: values };
  };
  const readTotals = async () =>
    (
      await tx.execute<AggregateRow>(sql`SELECT ${cardinality}::text AS count, ${metrics} AS metrics, ${digest} AS fingerprint
    FROM ${source()}`)
    ).rows[0];
  if (!options.groupBy.length) {
    const total = await readTotals();
    return {
      revision,
      count: Number(total.count),
      groups: [],
      ...statistics,
      ...resultMetrics(total),
      ...(query.fingerprint ? { fingerprint: total.fingerprint! } : {}),
    };
  }
  const fields = options.groupBy.map(
    (field) => sql`coalesce(${recordFieldSql(index, field, undefined, resolve, owner)}, 'null'::jsonb)`,
  );
  const group = typeof query.groupBy === "string" ? fields[0] : sql`jsonb_build_array(${sql.join(fields, sql`, `)})`;
  const totalMetrics = options.metrics.length
    ? sql`jsonb_build_object(${sql.join(
        options.metrics.flatMap(([name, metric]) => {
          const value = sql`${sql.raw(metric.operation)}((metrics ->> ${projectionKey(name)})::numeric) OVER ()`;
          return [sql`${projectionKey(name)}::text`, metric.operation === "sum" ? sql`coalesce(${value}, 0)` : value];
        }),
        sql`, `,
      )})`
    : sql`NULL::jsonb`;
  const grouped = await tx.execute<AggregateRow>(sql`WITH grouped AS (
    SELECT ${group} AS value, ${cardinality}::text AS count, ${metrics} AS metrics
    FROM ${source()} GROUP BY 1
  ) SELECT *, sum(count::numeric) OVER ()::text AS total_count, ${totalMetrics} AS total_metrics FROM grouped
    ${options.groupLimit === undefined ? sql`` : sql`LIMIT ${options.groupLimit + 1}`}`);
  if (options.groupLimit !== undefined && grouped.rows.length > options.groupLimit)
    throw new Error(`Aggregate has more than ${options.groupLimit} groups; narrow its selection`);
  // Derive totals from grouped numeric values inside SQL so decimal sums retain
  // the same precision as a direct aggregate over the original selection.
  const total = query.fingerprint
    ? await readTotals()
    : {
        count: grouped.rows[0]?.total_count ?? "0",
        fingerprint: null,
        metrics:
          grouped.rows[0]?.total_metrics ??
          Object.fromEntries(
            options.metrics.map(([name, metric]) => [projectionKey(name), metric.operation === "sum" ? 0 : null]),
          ),
      };
  return {
    revision,
    count: Number(total.count),
    ...statistics,
    ...resultMetrics(total),
    ...(query.fingerprint ? { fingerprint: total.fingerprint! } : {}),
    groups: grouped.rows
      .map((row) => ({
        value: decodeProjectionValue(row.value ?? null),
        count: Number(row.count),
        ...resultMetrics(row),
      }))
      .sort((a, b) => compareAggregateGroups(query, a.value, b.value)),
  };
};

export const canCountOwnerProjection = (index: StorageRecordIndex, query: StorageAggregateQuery) =>
  query.where === undefined &&
  query.groupBy === undefined &&
  query.metrics === undefined &&
  query.statistics === undefined &&
  query.fingerprint === undefined &&
  index.prefix === undefined &&
  !index.identity;
