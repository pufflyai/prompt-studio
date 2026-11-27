import { type SQL, sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import {
  type StorageAggregateQuery,
  type StorageExpression,
  type StoragePredicate,
  type StorageRecordIndex,
  validateStorageExpression,
} from "pstdio-sync-contracts";
import type { DbClient } from "../../db/connection.pglite";
import { recordIndexName } from "./record-index-lifecycle";
import { projectionKey } from "./record-projection-codec";

/** Only operations whose results depend entirely on the stored count dimensions
 * can read the smaller table. Other aggregates retain the canonical query. */
export const countIndexSource = async (
  tx: Pick<DbClient, "execute">,
  index: StorageRecordIndex,
  query: StorageAggregateQuery,
  candidate: { name: string | undefined; declared: StorageRecordIndex; owner: StorageOwner },
  predicateSql: SQL,
) => {
  const { name, declared, owner } = candidate;
  if (
    !name ||
    name.startsWith("storage_view_") ||
    !declared.countBy?.length ||
    name !== (await recordIndexName(owner, declared))
  )
    return;
  if (!index.countBy?.length || query.metrics || query.statistics || query.fingerprint) return;
  const supportedExpression = (expression: StorageExpression, visited: Set<string>) => {
    let valid = true;
    validateStorageExpression(expression, (field, up) => {
      if (up || !supportedField(field, visited)) valid = false;
    });
    return valid;
  };
  const supportedField = (field: string, visited: Set<string>): boolean => {
    if (visited.has(field)) return false;
    const declaration = index.fields[field];
    if (!declaration) return false;
    if (declaration.expression) return supportedExpression(declaration.expression, new Set([...visited, field]));
    if (declaration.cases) {
      const next = new Set([...visited, field]);
      return declaration.cases.every(({ when }) => supportedPredicate(when, next));
    }
    return Boolean(
      index.countBy?.includes(field) &&
        declaration.derive &&
        !declaration.expression &&
        !declaration.format &&
        !declaration.lookup,
    );
  };
  const supportedPredicate = (condition: StoragePredicate | undefined, visited: Set<string>): boolean => {
    if (!condition) return true;
    if ("all" in condition) return condition.all.every((item) => supportedPredicate(item, visited));
    if ("any" in condition) return condition.any.every((item) => supportedPredicate(item, visited));
    if ("not" in condition) return supportedPredicate(condition.not, visited);
    if ("test" in condition) return supportedExpression(condition.test, visited);
    return (
      "field" in condition &&
      ["eq", "ne", "in", "notIn"].includes(condition.op) &&
      supportedField(condition.field, visited)
    );
  };
  const groups = typeof query.groupBy === "string" ? [query.groupBy] : (query.groupBy ?? []);
  if (!supportedPredicate(query.where, new Set()) || !groups.every((field) => supportedField(field, new Set()))) return;
  const table = sql.identifier(`${name}_c`);
  if ((await tx.execute(sql`SELECT 1 FROM ${table} WHERE dims='null'::jsonb`)).rows.length) return;
  return sql`(SELECT jsonb_build_object(${projectionKey(index.name)}::text, dims) AS query_values, n FROM ${table}) AS records WHERE ${predicateSql}`;
};
