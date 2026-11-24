import { sql } from "drizzle-orm";
import {
  type StorageExpression,
  type StoragePredicate,
  type StorageRecordIndex,
  type StorageRelatedSelection,
  storageExpressionInfo,
} from "pstdio-sync-contracts";
import { queryExpressionBudget } from "./query-expression-sql";
import { expressionArray, expressionFoldedBytes, expressionString } from "./query-expression-values";
import { recordFieldSql, recordScopeSql } from "./record-query-sql";

const referenceField = (term: StorageExpression, name: string) => {
  if (!("op" in term) || term.op !== "equalsIgnoreCase" || term.args.length !== 2) return;
  const [left, right] = term.args;
  const field = "field" in left! ? left : right;
  const variable = field === left ? right : left;
  if (!field || !("field" in field) || (field.up ?? 0) !== 0) return;
  return variable && "variable" in variable && variable.variable === name ? field.field : undefined;
};

const referenceMatch = (expression: StorageExpression) => {
  if (!("each" in expression) || expression.mode !== "some" || !("field" in expression.each)) return;
  const up = expression.each.up ?? 0;
  if (up < 1) return;
  const terms = "op" in expression.where && expression.where.op === "or" ? expression.where.args : [expression.where];
  const fields = terms.map((term) => referenceField(term, expression.as));
  if (!fields.length || fields.some((field) => field === undefined)) return;
  const maxItems = Math.floor(queryExpressionBudget(expression) / storageExpressionInfo(expression.where).nodes);
  return { sourceField: expression.each.field, up, fields: [...new Set(fields as string[])], maxItems };
};

const necessaryReferenceMatch = (where?: StoragePredicate) => {
  const pending = where ? [where] : [];
  while (pending.length) {
    const condition = pending.pop()!;
    if ("all" in condition) pending.push(...condition.all);
    if ("test" in condition) {
      const match = referenceMatch(condition.test);
      if (match) return match;
    }
  }
};

const literalField = (index: StorageRecordIndex, name: string) => {
  if ([index.identity?.shorthandField, index.identity?.aliasesField, index.hierarchy?.breadcrumbField].includes(name))
    return;
  const field = index.fields[name];
  if (field?.expression || field?.cases || field?.lookup || field?.format) return;
  const expression = field?.derive?.kind === "expression" ? field.derive.expression : undefined;
  return expression && "literal" in expression && typeof expression.literal === "string"
    ? expression.literal
    : undefined;
};

/** Share narrow reference keys in one uncorrelated SQL initplan, then probe records by ID.
 * The original condition still checks membership and uniqueness; duplicate keys never duplicate rows. */
export const relatedReferenceCandidatesSql = (
  owner: Parameters<typeof recordScopeSql>[0],
  source: StorageRecordIndex,
  target: StorageRecordIndex,
  selection: StorageRelatedSelection,
  alias: string,
  ancestors: { index: StorageRecordIndex; alias: string }[],
  resolve: (name: string) => StorageRecordIndex,
) => {
  if (typeof owner.workbenchId !== "string" || typeof owner.extensionId !== "string") return;
  if (
    !selection.on.every((join) => {
      const value = literalField(source, join.sourceField);
      return (join.op ?? "eq") === "eq" && value !== undefined && value === literalField(target, join.relatedField);
    })
  )
    return;
  const match = necessaryReferenceMatch(selection.where);
  if (!match) return;
  const parent = ancestors[match.up - 1];
  if (
    !parent ||
    match.fields.some((name) => {
      const field = target.fields[name];
      return (
        field?.type !== "string" ||
        field.expression ||
        field.cases ||
        field.lookup ||
        field.format ||
        target.hierarchy?.breadcrumbField === name
      );
    })
  )
    return;
  const mapAlias = "reference_records";
  const values = match.fields.map((name) => sql`(${recordFieldSql(target, name, mapAlias, resolve, owner)})`);
  const key = sql`encode(${expressionFoldedBytes(sql`reference_value.value`)}, 'hex')`;
  const lookup = sql`(SELECT jsonb_object_agg(reference_group.key, reference_group.ids) FROM (
    SELECT ${key} AS key, jsonb_agg(DISTINCT ${sql.identifier(mapAlias)}.record_id) AS ids
    FROM storage_current_records AS ${sql.identifier(mapAlias)}
    CROSS JOIN LATERAL (VALUES ${sql.join(values, sql`, `)}) AS reference_value(value)
    WHERE ${recordScopeSql(owner, target, mapAlias)} AND ${expressionString(sql`reference_value.value`)}
    GROUP BY ${key}
  ) AS reference_group)`;
  const refs = recordFieldSql(parent.index, match.sourceField, parent.alias, resolve, owner);
  const member = sql`reference_member.value`;
  const keys = sql`SELECT DISTINCT encode(${expressionFoldedBytes(member)}, 'hex') AS key
    FROM jsonb_array_elements(${expressionArray(refs)}) AS reference_member(value) WHERE ${expressionString(member)}`;
  const ids = sql`ARRAY(SELECT DISTINCT candidate.value FROM (${keys}) AS reference_keys
    CROSS JOIN LATERAL jsonb_array_elements_text(coalesce(${lookup} -> reference_keys.key, '[]'::jsonb)) AS candidate(value))`;
  // Leave over-budget inputs to the original expression so its execution guard still applies.
  const allIds = sql`ARRAY(SELECT ${sql.identifier(mapAlias)}.record_id FROM storage_current_records AS ${sql.identifier(mapAlias)}
    WHERE ${recordScopeSql(owner, target, mapAlias)})`;
  return sql`${sql.identifier(alias)}.record_id = ANY(CASE
    WHEN jsonb_array_length(${expressionArray(refs)}) > ${match.maxItems} THEN ${allIds} ELSE ${ids} END)`;
};
