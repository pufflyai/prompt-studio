import { type SQL, sql } from "drizzle-orm";
import type { StorageRecordIndex } from "pstdio-sync-contracts";
import { expressionArray } from "./query-expression-values";

/** First record in C order for each string key. With a constant owner PostgreSQL
 * can build this lookup once per statement and use the shared records primary key. */
export const firstRecordByField = (
  index: StorageRecordIndex,
  name: string,
  alias: string,
  source: SQL,
  array: boolean,
  read: (alias: string) => SQL,
  scope: (alias: string) => SQL,
): SQL | undefined => {
  const field = index.fields[name];
  if (
    !field ||
    field.type !== "string" ||
    !field.path ||
    field.lookup ||
    field.expression ||
    field.cases ||
    field.format
  )
    return;
  if ([index.identity?.shorthandField, index.identity?.aliasesField, index.hierarchy?.breadcrumbField].includes(name))
    return;
  const key = read("candidate_row");
  // Keep the temporary JSON value bounded even for very large custom string keys.
  // Window aggregation can spill. Oversized maps fall back to a scoped equality lookup.
  const maxBytes = 8 * 1024 * 1024;
  const map = sql`(SELECT CASE WHEN max(bytes) > ${maxBytes} THEN '{"overflow":true}'::jsonb
    ELSE coalesce(jsonb_object_agg(candidate.key, candidate.id) FILTER (WHERE bytes <= ${maxBytes}), '{}'::jsonb) END
    FROM (SELECT grouped.*, sum(octet_length(grouped.key) + octet_length(grouped.id) + 32) OVER () AS bytes
      FROM (SELECT (${key})::text AS key, min(candidate_row.record_id COLLATE "C") AS id FROM records AS candidate_row
        WHERE ${scope("candidate_row")} AND ${key} IS NOT NULL AND ${key} <> 'null'::jsonb GROUP BY 1) grouped
    ) candidate)`;
  const id = sql`${sql.identifier(alias)}.record_id`;
  const members = sql`jsonb_array_elements(${expressionArray(source)}) AS member(value)`;
  const fallback = array
    ? sql`${read("candidate_fallback")} = ANY(ARRAY(SELECT member.value FROM ${members}))`
    : sql`${read("candidate_fallback")} = ${source}`;
  const first = sql`ARRAY(SELECT candidate_fallback.record_id FROM records AS candidate_fallback
    WHERE ${scope("candidate_fallback")} AND ${read("candidate_fallback")} <> 'null'::jsonb AND ${fallback}
    ORDER BY candidate_fallback.record_id COLLATE "C" LIMIT 1)`;
  const matches = array
    ? sql`ARRAY(SELECT lookup.keys ->> member.value::text FROM ${members})`
    : sql`ARRAY[lookup.keys ->> (${source})::text]`;
  return sql`${id} = ANY((SELECT CASE WHEN lookup.keys ? 'overflow' THEN ${first} ELSE ${matches} END
    FROM (SELECT ${map} AS keys OFFSET 0) AS lookup)::text[])`;
};
