import { sql } from "drizzle-orm";
import { queryField } from "pstdio-sync/records";
import type { StoragePredicate, StorageRecordIndex, StorageRelatedSelection } from "pstdio-sync-contracts";
import { type QuerySqlOwner, recordFieldSql, recordScopeSql } from "./record-query-sql";

const semanticField = (index: StorageRecordIndex, field: string) =>
  field === index.identity?.shorthandField ||
  field === index.identity?.aliasesField ||
  field === index.hierarchy?.breadcrumbField;

const selectedSourceValues = (where: StoragePredicate | undefined, field: string): boolean => {
  if (!where) return false;
  if ("field" in where) return where.field === field && (where.op === "eq" || where.op === "in");
  if ("all" in where) return where.all.some((part) => selectedSourceValues(part, field));
  if ("any" in where) return where.any.length > 0 && where.any.every((part) => selectedSourceValues(part, field));
  return false;
};

/** A record-local scalar membership can build its target set once per statement.
 * Correlated EXISTS can repeatedly compare every target while fresh indexes still
 * have the empty-table statistics from installation.
 */
export const relatedScalarMembershipSql = (
  owner: QuerySqlOwner,
  source: StorageRecordIndex,
  target: StorageRecordIndex,
  selection: StorageRelatedSelection,
  resolve: (name: string) => StorageRecordIndex,
  sourceAlias: string,
  targetAlias: string,
  negated = false,
  sourceWhere?: StoragePredicate,
) => {
  // Positive point lookups retain their correlated equality-index probe.
  if (!negated || selection.where || selection.every || selection.on.length !== 1) return;
  const join = selection.on[0];
  if (selectedSourceValues(sourceWhere, join.sourceField)) return;
  if (join.op || semanticField(source, join.sourceField) || semanticField(target, join.relatedField)) return;
  const sourceType = queryField(source, join.sourceField).type;
  const targetType = queryField(target, join.relatedField).type;
  if (!(["string", "number", "boolean"] as string[]).includes(sourceType) || sourceType !== targetType) return;
  const left = recordFieldSql(source, join.sourceField, sourceAlias, resolve, owner);
  const right = recordFieldSql(target, join.relatedField, targetAlias, resolve, owner);
  // Exclude SQL and JSON nulls exactly as the correlated relationship predicate does.
  return sql`(${left} IS NOT NULL AND ${left} <> 'null'::jsonb AND ${left} IN (
    SELECT ${right} FROM storage_current_records AS ${sql.identifier(targetAlias)}
    WHERE ${recordScopeSql(owner, target, targetAlias)}
      AND ${right} IS NOT NULL AND ${right} <> 'null'::jsonb
  ))`;
};
