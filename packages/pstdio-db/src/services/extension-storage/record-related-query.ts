import { type SQL, sql } from "drizzle-orm";
import { loadQueryIndexDependencies } from "pstdio-sync/records";
import type { StoragePredicate, StorageRecordIndex } from "pstdio-sync-contracts";
import { queryExpressionSql } from "./query-expression-sql";
import { expressionArray, expressionComparable } from "./query-expression-values";
import { predicateSql, recordEqualitySql, recordFieldSql, recordScopeSql } from "./record-query-sql";
import { relatedScalarMembershipSql } from "./record-related-membership";

export const loadRelatedQueryIndexes = async (
  where: StoragePredicate | undefined,
  read: (name: string) => Promise<StorageRecordIndex>,
  root?: StorageRecordIndex,
) => {
  const loaded = await loadQueryIndexDependencies(root, where, read);
  return Object.assign(loaded.resolve, { hasIdentity: loaded.hasIdentity, definitions: loaded.definitions });
};

/** Correlation stays in SQL; both endpoints are constrained to the caller before selection. */
let statementSequence = 0;
export const relatedRecordPredicateSql = (
  owner: Parameters<typeof recordScopeSql>[0],
  index: StorageRecordIndex,
  where: StoragePredicate | undefined,
  indexFor: (name: string) => StorageRecordIndex,
  rootAlias = "storage_current_records",
) => {
  const statement = statementSequence++;
  const compile = (
    source: StorageRecordIndex,
    predicate: StoragePredicate | undefined,
    alias: string,
    depth: number,
    ancestors: { index: StorageRecordIndex; alias: string }[] = [],
    variables = new Map<string, SQL>(),
  ) => {
    const result: SQL = predicateSql(
      source,
      predicate,
      (outer, selection, _alias, negated) => {
        const target = indexFor(selection.index);
        const targetAlias = `related_${statement}_${depth}`;
        const membership = relatedScalarMembershipSql(
          owner,
          outer,
          target,
          selection,
          indexFor,
          alias,
          targetAlias,
          negated,
          predicate,
        );
        if (membership) return membership;
        const joins = selection.on.map((join) => {
          const left = recordFieldSql(outer, join.sourceField, alias, indexFor, owner);
          const right = recordFieldSql(target, join.relatedField, targetAlias, indexFor, owner);
          let matches = recordEqualitySql(
            target,
            join.relatedField,
            sql`coalesce(${right}, 'null'::jsonb)`,
            sql`coalesce(${left}, 'null'::jsonb)`,
          );
          if (join.op === "contains") {
            // Probe the scalar equality key once per source member. A correlated
            // target-in-source containment test otherwise scans every target.
            const members = sql`jsonb_array_elements(${expressionArray(left)}) AS dependency_member(value)`;
            const scalar = sql`coalesce(${right}, 'null'::jsonb)`;
            const indexed = target.equality?.includes(join.relatedField);
            const probes = indexed
              ? sql`md5((${scalar})::text) = ANY (ARRAY(SELECT md5((dependency_member.value)::text) FROM ${members}))`
              : sql`${right} = ANY (ARRAY(SELECT dependency_member.value FROM ${members}))`;
            matches = sql`${probes} AND ${left} @> jsonb_build_array(${right})`;
          }
          if (join.op === "containedBy") matches = sql`${right} @> jsonb_build_array(${left})`;
          if (
            outer.identity?.shorthandField === join.sourceField ||
            target.identity?.shorthandField === join.relatedField ||
            outer.hierarchy?.breadcrumbField === join.sourceField ||
            target.hierarchy?.breadcrumbField === join.relatedField
          ) {
            matches = identityJoinSql(left, right, join.op);
          }
          // Null/missing joins have no relationship. JSON comparisons preserve encoded strings.
          return sql`(${left} IS NOT NULL AND ${left} <> 'null'::jsonb AND ${right} IS NOT NULL AND ${right} <> 'null'::jsonb AND ${matches})`;
        });
        const each = selection.every;
        const itemAlias = sql.identifier(`related_item_${statement}_${depth}`);
        const names = each ? new Map(variables).set(each.as, sql`${itemAlias}.value`) : variables;
        const selected = sql`SELECT 1 FROM storage_current_records AS ${sql.identifier(targetAlias)}
          WHERE ${recordScopeSql(owner, target, targetAlias)} AND ${sql.join(joins, sql` AND `)}
          AND ${compile(target, selection.where, targetAlias, depth + 1, [{ index: source, alias }, ...ancestors], names)}`;
        if (!each) return sql`EXISTS (${selected})`;
        const values = recordFieldSql(outer, each.field, alias, indexFor, owner);
        const matched =
          each.matches === "one"
            ? sql`(SELECT count(*) FROM (${selected} LIMIT 2) AS unique_match) = 1`
            : sql`EXISTS (${selected})`;
        return sql`(jsonb_typeof(${values}) = 'array' AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(${expressionArray(values)}) AS ${itemAlias}(value) WHERE NOT (${matched})))`;
      },
      alias,
      (expression) =>
        queryExpressionSql(
          expression,
          (name, up) => {
            const scope = [{ index: source, alias }, ...ancestors][up];
            if (!scope) throw new Error("Invalid expression ancestor scope");
            return recordFieldSql(scope.index, name, scope.alias, indexFor, owner);
          },
          variables,
        ),
      indexFor,
      owner,
    );
    return result;
  };
  return compile(index, where, rootAlias, 0);
};

const identityJoinSql = (left: SQL, right: SQL, operation?: string) => {
  let matches: SQL;
  matches = sql`${expressionComparable(left)} = ${expressionComparable(right)}`;
  if (operation === "contains")
    matches = sql`EXISTS (SELECT 1 FROM jsonb_array_elements(${expressionArray(left)}) AS identity_member(value) WHERE ${expressionComparable(sql`identity_member.value`)} = ${expressionComparable(right)})`;
  if (operation === "containedBy")
    matches = sql`EXISTS (SELECT 1 FROM jsonb_array_elements(${expressionArray(right)}) AS identity_member(value) WHERE ${expressionComparable(sql`identity_member.value`)} = ${expressionComparable(left)})`;
  return matches;
};
