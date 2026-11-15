import { type SQL, sql } from "drizzle-orm";
import type { StorageRecordIndex, StorageRecordQuery } from "pstdio-sync-contracts";
import { expressionArray } from "./query-expression-values";
import { projectionKey } from "./record-projection-codec";
import { pageOrderSql } from "./record-query-page";
import { type QuerySqlOwner, recordFieldSql, sqlLiteral } from "./record-query-sql";

/** The graph is a database working set. Only the selected batch's fields cross the storage boundary. */
export const dependencyOrderedPageSql = (
  owner: QuerySqlOwner,
  index: StorageRecordIndex,
  graph: NonNullable<StorageRecordQuery["dependencyOrder"]>,
  fields: string[],
  where: SQL,
  limit: number,
  resolve: (name: string) => StorageRecordIndex,
) => {
  const selected = fields.flatMap((name) => [
    sqlLiteral(projectionKey(name)),
    sql`coalesce(${recordFieldSql(index, name, undefined, resolve, owner)}, 'null'::jsonb)`,
  ]);
  return sql`WITH RECURSIVE
    candidates AS MATERIALIZED (
      SELECT record_id, ${recordFieldSql(index, graph.idField, undefined, resolve, owner)} AS graph_id,
        ${recordFieldSql(index, graph.dependenciesField, undefined, resolve, owner)} AS refs,
        row_number() OVER (ORDER BY ${pageOrderSql(index, resolve, owner)}) AS priority
      FROM storage_current_records WHERE ${where}
    ),
    nodes AS MATERIALIZED (
      SELECT candidates.*, min(priority) OVER (PARTITION BY graph_id) AS identity_priority FROM candidates
    ),
    identities AS MATERIALIZED (
      SELECT DISTINCT graph_id, identity_priority FROM nodes WHERE graph_id IS NOT NULL AND graph_id <> 'null'::jsonb
    ),
    edges AS MATERIALIZED (
      SELECT source.record_id, array_agg(DISTINCT target.identity_priority) AS dependencies
      FROM nodes source
      CROSS JOIN LATERAL jsonb_array_elements(${expressionArray(sql`source.refs`)}) member(value)
      INNER JOIN identities target ON target.graph_id = member.value AND target.graph_id IS DISTINCT FROM source.graph_id
      GROUP BY source.record_id
    ),
    graph AS MATERIALIZED (
      SELECT nodes.record_id, nodes.priority, coalesce(edges.dependencies, ARRAY[]::bigint[]) AS dependencies
      FROM nodes LEFT JOIN edges ON edges.record_id = nodes.record_id
    ),
    reverse_edges AS MATERIALIZED (
      SELECT graph.priority AS dependent, prerequisite
      FROM graph CROSS JOIN LATERAL unnest(graph.dependencies) prerequisite
    ),
    walk AS (
      SELECT ARRAY[]::bigint[] AS selected, ARRAY[]::bigint[] AS satisfied, 0 AS depth,
        coalesce(array_agg(priority ORDER BY priority), ARRAY[]::bigint[]) AS remaining,
        coalesce(array_agg(priority) FILTER (WHERE cardinality(dependencies) = 0), ARRAY[]::bigint[]) AS ready,
        coalesce(jsonb_object_agg(priority::text, cardinality(dependencies)), '{}'::jsonb) AS counts
      FROM graph
      UNION ALL
      SELECT walk.selected || chosen.priority, walk.satisfied || chosen.identity_priority, walk.depth + 1,
        array_remove(walk.remaining, chosen.priority),
        array_remove(walk.ready, chosen.priority) || updates.awakened,
        walk.counts || updates.counts
      FROM walk
      CROSS JOIN LATERAL (
        SELECT coalesce((SELECT min(value) FROM unnest(walk.ready) value), walk.remaining[1]) AS priority
      ) first_ready
      INNER JOIN nodes chosen ON chosen.priority = first_ready.priority
      CROSS JOIN LATERAL (
        SELECT coalesce(jsonb_object_agg(dependent::text, pending), '{}'::jsonb) AS counts,
          coalesce(array_agg(dependent) FILTER (WHERE pending = 0), ARRAY[]::bigint[]) AS awakened
        FROM (
          SELECT dependent, (walk.counts ->> dependent::text)::integer - 1 AS pending
          FROM reverse_edges
          WHERE prerequisite = chosen.identity_priority
            AND NOT dependent = ANY(walk.selected || chosen.priority)
            AND NOT chosen.identity_priority = ANY(walk.satisfied)
        ) changed
      ) updates
      WHERE walk.depth < ${limit}
    )
    SELECT storage_current_records.record_id, revision,
      jsonb_build_object(${sql.join(selected, sql`, `)}) AS fields, '[]'::jsonb AS sort_values
    FROM (SELECT selected FROM walk ORDER BY depth DESC LIMIT 1) batch
    CROSS JOIN LATERAL unnest(batch.selected) WITH ORDINALITY chosen(priority, position)
    INNER JOIN nodes ON nodes.priority = chosen.priority
    INNER JOIN storage_current_records ON storage_current_records.record_id = nodes.record_id
      AND storage_current_records.workbench_id = ${owner.workbenchId}
      AND storage_current_records.extension_id = ${owner.extensionId}
    ORDER BY chosen.position`;
};
