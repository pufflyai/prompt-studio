import { type SQL, sql } from "drizzle-orm";
import { histogramResult, statisticOptions, topValuesResult } from "pstdio-sync/records";
import type { Json, StorageAggregateQuery, StorageRecordIndex, StorageStatisticResult } from "pstdio-sync-contracts";
import type { DbClient } from "../../db/connection.pglite";
import { recordNumberTextSql } from "./record-number-text";
import { decodeProjectionValue } from "./record-projection-codec";
import { projectionStringSortSql, type QuerySqlOwner, recordFieldSql } from "./record-query-sql";
import { prepareLocaleCollation, projectionTextSql } from "./record-text-order";

type Reader = Pick<DbClient, "execute">;
const histogram = async (tx: Reader, source: SQL, bins: number) => {
  const result = await tx.execute<{ min: string | null; max: string | null; counts: Record<string, number> }>(sql`
    WITH values AS MATERIALIZED (${source}), numbers AS MATERIALIZED (
      SELECT (value #>> '{}')::numeric AS value FROM values
    ), bounds AS MATERIALIZED (SELECT min(value) AS min, max(value) AS max FROM numbers), counts AS (
      SELECT CASE WHEN max = min OR value = max THEN ${bins - 1}
        ELSE least(${bins - 1}, div((value-min)*${bins}, max-min)::integer) END AS bucket, count(*) AS count
      FROM numbers CROSS JOIN bounds GROUP BY 1
    ) SELECT min::text, max::text, coalesce(jsonb_object_agg(bucket::text, count) FILTER (WHERE bucket IS NOT NULL), '{}'::jsonb) AS counts
      FROM bounds LEFT JOIN counts ON true GROUP BY min, max`);
  const row = result.rows[0];
  if (row.min === null || row.max === null) return null;
  return histogramResult(
    Number(row.min),
    Number(row.max),
    bins,
    new Map(Object.entries(row.counts).map(([key, count]) => [Number(key), count])),
  );
};
const topValues = async (tx: Reader, source: SQL, limit: number, numeric: boolean, locale?: string) => {
  const collation = await prepareLocaleCollation(tx, locale ?? new Intl.Collator().resolvedOptions().locale);
  const label = numeric ? recordNumberTextSql(sql`value`) : projectionTextSql(sql`value`);
  const result = await tx.execute<{ value: Json; count: string; total: string }>(sql`
    WITH values AS MATERIALIZED (${source}), grouped AS (
      SELECT value, count(*)::text AS count, min(record_id COLLATE "C") AS first FROM values GROUP BY value
    ) SELECT value, count, sum(count::numeric) OVER ()::text AS total FROM grouped
      ORDER BY count::numeric DESC, (${label} IS NULL), (${label}) COLLATE ${sql.identifier(collation)},
        CASE WHEN ${label} IS NULL THEN ${projectionStringSortSql(sql`value`)} ELSE NULL::bytea END,
        first COLLATE "C" LIMIT ${limit}`);
  const groups = result.rows.map(({ value, count }) => ({
    label: String(decodeProjectionValue(value)),
    count: Number(count),
  }));
  return topValuesResult(groups, Number(result.rows[0]?.total ?? 0));
};

/** Counts, histograms and top groups remain SQL working sets; only bounded summaries leave the database. */
export const aggregateRecordStatistics = async (
  tx: Reader,
  index: StorageRecordIndex,
  query: StorageAggregateQuery,
  where: SQL,
  resolve?: (name: string) => StorageRecordIndex,
  owner?: QuerySqlOwner,
) => {
  const results: Record<string, StorageStatisticResult> = {};
  for (const [name, statistic] of statisticOptions(index, query)) {
    const field = recordFieldSql(index, statistic.field, undefined, resolve, owner);
    const source = sql`SELECT record_id, ${field} AS value FROM records
      WHERE ${where} AND ${field} IS NOT NULL AND ${field} NOT IN ('null'::jsonb, '""'::jsonb)`;
    await owner?.firstMatches?.prepare(tx);
    if (statistic.type === "unique") {
      const result = await tx.execute<{ count: string }>(
        sql`SELECT count(DISTINCT value)::text AS count FROM (${source}) selected`,
      );
      results[name] = { type: "unique", count: Number(result.rows[0].count) };
    } else if (statistic.type === "histogram")
      results[name] = { type: "histogram", histogram: await histogram(tx, source, statistic.bins ?? 10) };
    else
      results[name] = {
        type: "top-values",
        values: await topValues(
          tx,
          source,
          statistic.limit ?? 2,
          index.fields[statistic.field].type === "number",
          statistic.locale,
        ),
      };
  }
  return results;
};
