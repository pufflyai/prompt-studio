import { type SQL, sql } from "drizzle-orm";
import type { StorageIndexField } from "pstdio-sync-contracts";
import { expressionLiteral, expressionObject, expressionString } from "./query-expression-values";
import { projectionStringTag } from "./record-projection-codec";

export const typedComputedFieldSql = (source: SQL, field: StorageIndexField) => {
  const value = sql`computed_field.value`;
  let valid = sql`jsonb_typeof(${value}) = ${expressionLiteral(field.type)}`;
  if (field.type === "string") valid = expressionString(value);
  if (field.type === "object") valid = expressionObject(value);
  if (field.type === "array")
    valid = sql`${valid} AND NOT jsonb_path_exists(${value}, ${expressionLiteral(`$[*] ? (@.type() != "string" && !exists(@.${JSON.stringify(projectionStringTag)}))`)})`;
  return sql`(SELECT CASE WHEN ${value} = 'null'::jsonb OR (${valid}) THEN ${value} ELSE NULL END
    FROM (SELECT ${source} AS value OFFSET 0) AS computed_field)`;
};
