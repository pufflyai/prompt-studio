import { type SQL, sql } from "drizzle-orm";
import type { StorageRecordIndex } from "pstdio-sync-contracts";
import { expressionHex, expressionLiteral, expressionString } from "./query-expression-values";
import { queryStringFromHex } from "./query-string-codec";

/** Only the resulting label leaves SQL. Deep ancestry is never hydrated into an extension. */
export const recordHierarchySql = (
  index: StorageRecordIndex,
  outer: string,
  field: (name: string, alias: string) => SQL,
  scope: (alias: string) => SQL,
  equal: (field: string, left: SQL, right: SQL) => SQL,
) => {
  const hierarchy = index.hierarchy!;
  const source = sql.identifier(outer);
  const ancestor = sql.identifier("hierarchy_ancestor");
  return sql`(WITH RECURSIVE lineage AS (
    SELECT ${field(hierarchy.idField, "hierarchy_ancestor")} AS id,
      ${field(hierarchy.parentField, "hierarchy_ancestor")} AS parent,
      ${field(hierarchy.labelField, "hierarchy_ancestor")} AS label,
      ARRAY[${ancestor}.record_id] AS visited, 0 AS depth
    FROM storage_current_records AS ${ancestor}
    WHERE ${ancestor}.record_id = ${source}.record_id AND ${scope("hierarchy_ancestor")}
    UNION ALL
    SELECT parent.id, parent.parent, parent.label, lineage.visited || parent.record_id, lineage.depth + 1
    FROM lineage CROSS JOIN LATERAL (
      SELECT ${field(hierarchy.idField, "hierarchy_ancestor")} AS id, ${field(hierarchy.parentField, "hierarchy_ancestor")} AS parent,
        ${field(hierarchy.labelField, "hierarchy_ancestor")} AS label, ${ancestor}.record_id
      FROM storage_current_records AS ${ancestor}
      WHERE lineage.parent IS NOT NULL AND lineage.parent <> 'null'::jsonb
        AND ${scope("hierarchy_ancestor")} AND ${equal(hierarchy.idField, field(hierarchy.idField, "hierarchy_ancestor"), sql`lineage.parent`)}
      ORDER BY ${ancestor}.record_id COLLATE "C" LIMIT 1
    ) AS parent WHERE NOT (parent.record_id = ANY(lineage.visited))
  ) SELECT ${queryStringFromHex(sql`string_agg(${expressionHex(sql`lineage.label`)}, ${expressionLiteral(Buffer.from(hierarchy.separator, "utf16le").toString("hex"))} ORDER BY lineage.depth DESC) FILTER (WHERE ${expressionString(sql`lineage.label`)})`)} FROM lineage)`;
};
