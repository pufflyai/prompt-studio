import { type SQL, sql } from "drizzle-orm";
import { queryField } from "pstdio-sync/records";
import type {
  Json,
  StorageExpression,
  StoragePredicate,
  StorageRecordIndex,
  StorageRelatedSelection,
} from "pstdio-sync-contracts";
import { queryExpressionSql } from "./query-expression-sql";
import { expressionComparable } from "./query-expression-values";
import { recordTextMatch, stringBytesSql } from "./query-string-codec";
import { typedComputedFieldSql } from "./record-computed-field";
import { formatCacheFields } from "./record-format-key";
import { recordIdentityPrefixSql } from "./record-identity-order";
import { identityPredicateSql } from "./record-identity-predicate";
import { identityQueryText } from "./record-identity-query";
import { recordNumberTextSql } from "./record-number-text";
import {
  encodeProjectionValue,
  projectionKey,
  projectionStringBytes,
  projectionStringTag,
  projectionSubstringBytes,
} from "./record-projection-codec";
import { cachedQueryFieldSql } from "./record-query-field-cache";
import { recordHierarchySql } from "./record-query-hierarchy";
import { recordLookupSql } from "./record-query-lookup";
import { relatedRecordPredicateSql } from "./record-related-query";
import { identityQueryKey } from "./resource-query-values";

export const sqlLiteral = (value: string) => sql.raw(`'${value.replaceAll("'", "''")}'`);
export type QuerySqlOwner = { workbenchId: string | SQL; extensionId: string | SQL };
const json = (value: Json) => sql`${JSON.stringify(encodeProjectionValue(value))}::jsonb`;
export const projectionStringSortSql = (value: SQL) => stringBytesSql(value);
export const sortValueSql = (value: Json) =>
  typeof value === "string" ? sql`decode(${projectionStringBytes(value)}, 'hex')` : json(value);
const column = (name: string, alias?: string) =>
  alias ? sql`${sql.identifier(alias)}.${sql.identifier(name)}` : sql`${sql.identifier(name)}`;
export const recordScopeSql = (owner: QuerySqlOwner, index: StorageRecordIndex, alias?: string) =>
  sql`${column("workbench_id", alias)} = ${typeof owner.workbenchId === "string" ? sqlLiteral(owner.workbenchId) : owner.workbenchId} AND ${column("extension_id", alias)} = ${typeof owner.extensionId === "string" ? sqlLiteral(owner.extensionId) : owner.extensionId}
    AND NOT ${column("deleted", alias)} ${index.prefix === undefined ? sql`` : sql`AND starts_with(${column("record_id", alias)}, ${sqlLiteral(index.prefix)})`}
    ${index.identity ? sql`AND ${recordIdentitySql(index, alias)} IS NOT NULL` : sql``}`;
const recordIdentitySql = (index: StorageRecordIndex, alias = "storage_current_records", field = "shorthand") => {
  if (!index.identity) throw new Error("Identity index declaration required");
  const id: SQL = recordFieldSql(index, index.identity.idField, alias);
  return sql`(SELECT core.query_values #> ARRAY[${sqlLiteral(identityQueryKey)}, ${sqlLiteral(field)}] FROM storage_resource_identities AS identity
    INNER JOIN storage_current_records core ON core.workbench_id = identity.workbench_id AND core.extension_id = 'pstdio' AND core.record_id = identity.resource_id
    WHERE identity.workbench_id = ${column("workbench_id", alias)} AND identity.extension_id = ${column("extension_id", alias)}
      AND identity.kind = ${sqlLiteral(index.identity.kind)} AND identity.resource_id = ${identityQueryText(id)})`;
};
const recordAncestorsSql = (source: SQL, path: SQL[]) => {
  const parents = path.map(
    (_, position) =>
      sql`jsonb_typeof(${source} #> ARRAY[${sql.join(path.slice(0, position), sql`, `)}]::text[]) = 'object'`,
  );
  return parents.length ? sql.join(parents, sql` AND `) : sql`true`;
};

export const recordFieldSql = (
  index: StorageRecordIndex,
  name: string,
  alias?: string,
  resolve?: (name: string) => StorageRecordIndex,
  owner?: QuerySqlOwner,
) => {
  const field = queryField(index, name);
  const cached = cachedQueryFieldSql(index, name, alias);
  if (cached) return cached;
  if (field.format) {
    const cache = formatCacheFields.get(field);
    if (!cache) throw new Error("Date formatting cache is not prepared");
    return sql`(${column("query_values", alias)} #> ARRAY[${sqlLiteral(projectionKey(cache))}, 'value']::text[])`;
  }
  if (field.cases) return conditionalFieldSql(index, name, alias, resolve, owner);
  if (field.lookup) {
    if (!resolve) throw new Error("Related field needs installed indexes");
    const outer = alias ?? "storage_current_records";
    const value: SQL = recordLookupSql(
      index,
      field,
      outer,
      resolve,
      (index, field, alias) => recordFieldSql(index, field, alias, resolve, owner),
      (index, alias) =>
        recordScopeSql(
          owner ?? { workbenchId: column("workbench_id", outer), extensionId: column("extension_id", outer) },
          index,
          alias,
        ),
      recordEqualitySql,
    );
    return value;
  }
  if (index.hierarchy?.breadcrumbField === name) {
    const outer = alias ?? "storage_current_records";
    const value: SQL = recordHierarchySql(
      index,
      outer,
      (field, alias) => recordFieldSql(index, field, alias, resolve, owner),
      (alias) =>
        recordScopeSql(
          owner ?? { workbenchId: column("workbench_id", outer), extensionId: column("extension_id", outer) },
          index,
          alias,
        ),
      (field, left, right) =>
        recordEqualitySql(index, field, sql`coalesce(${left}, 'null'::jsonb)`, sql`coalesce(${right}, 'null'::jsonb)`),
    );
    return value;
  }
  if (index.identity?.shorthandField === name) {
    const value: SQL = recordIdentitySql(index, alias);
    return value;
  }
  if (index.identity?.aliasesField === name) return recordIdentitySql(index, alias, "aliases");
  if (field.expression) {
    const result: SQL = queryExpressionSql(field.expression, (name, up) => {
      if (up) throw new Error("Computed fields must be record local");
      return recordFieldSql(index, name, alias ?? "storage_current_records", resolve, owner);
    });
    return typedComputedFieldSql(result, field);
  }
  if (field.derive)
    return sql`(${column("query_values", alias)} #> ARRAY[${sqlLiteral(projectionKey(index.name))}, ${sqlLiteral(projectionKey(name))}]::text[])`;
  const path = (field.path ?? []).map((part) => sqlLiteral(projectionKey(part)));
  const source = column("value", alias);
  const value = sql`(${source} #> ARRAY[${sql.join(path, sql`, `)}]::text[])`;
  const ancestors = recordAncestorsSql(source, path);
  const type = field.type === "array" ? "array" : field.type;
  const validArray =
    field.type === "array"
      ? sql`AND NOT jsonb_path_exists(${value}, ${sqlLiteral(`$[*] ? (@.type() != "string" && !exists(@.${JSON.stringify(projectionStringTag)}))`)})`
      : sql``;
  const encodedString =
    field.type === "string"
      ? sql`OR (jsonb_typeof(${value}) = 'object' AND ${value} ? ${sqlLiteral(projectionStringTag)})`
      : sql``;
  const validObject = field.type === "object" ? sql`AND NOT (${value} ? ${sqlLiteral(projectionStringTag)})` : sql``;
  return sql`(CASE WHEN (${ancestors}) AND (${value} = 'null'::jsonb OR (jsonb_typeof(${value}) = ${sqlLiteral(type)} ${validArray} ${validObject}) ${encodedString}) THEN ${value} ELSE NULL END)`;
};
export const sortFieldSql = (
  index: StorageRecordIndex,
  name: string,
  alias?: string,
  resolve?: (name: string) => StorageRecordIndex,
  owner?: QuerySqlOwner,
) => {
  const value = sql`nullif(${recordFieldSql(index, name, alias, resolve, owner)}, 'null'::jsonb)`;
  return queryField(index, name).type === "string" ? stringBytesSql(value) : value;
};

export const arrayIndexFields = (index: StorageRecordIndex) =>
  Object.entries(index.fields).filter(
    ([name, field]) =>
      name !== index.identity?.aliasesField && !field.lookup && (field.type === "array" || field.type === "object"),
  );

const equalityKey = (value: SQL) => sql`md5((${value})::text)`;
const inListSql = (members: Json[], comparable: SQL, indexed: boolean, normalize: (member: SQL) => SQL) => {
  if (!members.length) return sql`false`;
  // Keep a bounded number of bind parameters for large lists.
  if (members.length > 1_000) {
    const input = sql`jsonb_array_elements(${json(members)}) AS wanted(item)`;
    const values = sql`${comparable} = ANY(ARRAY(SELECT ${normalize(sql`item`)} FROM ${input}))`;
    if (!indexed) return values;
    const keys = sql`ARRAY(SELECT ${equalityKey(sql`item`)} FROM ${input})`;
    return sql`(${equalityKey(comparable)} = ANY(${keys}) AND ${values})`;
  }
  const wanted = members.map((item) => normalize(json(item)));
  const values = sql`ARRAY[${sql.join(wanted, sql`, `)}]::jsonb[]`;
  if (!indexed) return sql`${comparable} = ANY(${values})`;
  const keys = sql`ARRAY[${sql.join(wanted.map(equalityKey), sql`, `)}]`;
  return sql`(${equalityKey(comparable)} = ANY(${keys}) AND ${comparable} = ANY(${values}))`;
};
const localField = (index: StorageRecordIndex, field: string) =>
  !queryField(index, field).lookup &&
  index.identity?.shorthandField !== field &&
  index.identity?.aliasesField !== field &&
  index.hierarchy?.breadcrumbField !== field;
export const recordEqualitySql = (index: StorageRecordIndex, field: string, comparable: SQL, value: SQL) => {
  if (!localField(index, field) && queryField(index, field).type === "string")
    return sql`${expressionComparable(comparable)} = ${expressionComparable(value)}`;
  return index.equality?.includes(field)
    ? sql`(${equalityKey(comparable)} = ${equalityKey(value)} AND ${comparable} = ${value})`
    : sql`${comparable} = ${value}`;
};
export const orderingPrefix = (
  index: StorageRecordIndex,
  name: string,
  resolve?: (name: string) => StorageRecordIndex,
  owner?: QuerySqlOwner,
) =>
  sql`substring(${sortFieldSql(index, name, undefined, resolve, owner)} from 1 for ${sql.raw(String(Math.max(1, Math.floor(1024 / (index.orderBy?.length || 1)))))})`;

export const recordIndexKeys = (index: StorageRecordIndex) => {
  const local = (field: string) => localField(index, field);
  const keys: SQL[] = (index.equality ?? [])
    .filter(local)
    .map((field) => sql`(${equalityKey(sql`coalesce(${recordFieldSql(index, field)}, 'null'::jsonb)`)})`);
  for (const sort of (index.orderBy ?? []).filter((sort) => local(sort.field)))
    keys.push(
      sql`(${queryField(index, sort.field).type === "string" ? orderingPrefix(index, sort.field) : sortFieldSql(index, sort.field)}) ${sql.raw(sort.direction)} NULLS LAST`,
    );
  keys.push(sql`(${recordIdentityPrefixSql()})`);
  return keys;
};

type RelatedSql = (
  index: StorageRecordIndex,
  selection: StorageRelatedSelection,
  alias?: string,
  negated?: boolean,
) => SQL;
export const predicateSql = (
  index: StorageRecordIndex,
  predicate?: StoragePredicate,
  related?: RelatedSql,
  alias?: string,
  expression?: (expression: StorageExpression) => SQL,
  resolve?: (name: string) => StorageRecordIndex,
  owner?: QuerySqlOwner,
  negated = false,
) => {
  if (!predicate) return sql`true`;
  if ("test" in predicate) {
    if (!expression) throw new Error("Expression query needs field scopes");
    return sql`${expression(predicate.test)} = 'true'::jsonb`;
  }
  if ("exists" in predicate) {
    if (!related) throw new Error("Related query needs installed indexes");
    return related(index, predicate.exists, alias, negated);
  }
  // Missing typed values fail comparisons; negation must complement that false result.
  if ("not" in predicate) {
    const child: SQL = predicateSql(index, predicate.not, related, alias, expression, resolve, owner, !negated);
    return sql`NOT coalesce(${child}, false)`;
  }
  if ("all" in predicate) {
    const parts: SQL[] = [];
    for (const child of predicate.all)
      parts.push(predicateSql(index, child, related, alias, expression, resolve, owner, negated));
    return parts.length ? sql`(${sql.join(parts, sql` AND `)})` : sql`true`;
  }
  if ("any" in predicate) {
    const parts: SQL[] = [];
    for (const child of predicate.any)
      parts.push(predicateSql(index, child, related, alias, expression, resolve, owner, negated));
    return parts.length ? sql`(${sql.join(parts, sql` OR `)})` : sql`false`;
  }
  return fieldPredicateSql(index, predicate, alias, resolve, owner);
};

const fieldEqualitySql = (index: StorageRecordIndex, field: string, comparable: SQL, value: SQL) => {
  // Typed booleans have only three index keys (true, false, and null), with distinct hashes.
  // A second equality check makes Postgres underestimate common values and sort a full page source.
  if (queryField(index, field).type === "boolean" && localField(index, field) && index.equality?.includes(field))
    return sql`${equalityKey(comparable)} = ${equalityKey(value)}`;
  return recordEqualitySql(index, field, comparable, value);
};

const fieldPredicateSql = (
  index: StorageRecordIndex,
  predicate: Extract<StoragePredicate, { field: string }>,
  alias?: string,
  resolve?: (name: string) => StorageRecordIndex,
  owner?: QuerySqlOwner,
) => {
  const identity = identityPredicateSql(index, predicate, owner, () =>
    recordFieldSql(index, index.identity!.idField, alias, resolve, owner),
  );
  if (identity) return identity;
  const field = recordFieldSql(index, predicate.field, alias, resolve, owner);
  const projectedString = !localField(index, predicate.field) && queryField(index, predicate.field).type === "string";
  const valueJson = (value: Json) => {
    return projectedString ? expressionComparable(json(value)) : json(value);
  };
  const original = sql`coalesce(${field}, 'null'::jsonb)`;
  const comparable = projectedString ? expressionComparable(original) : original;
  const empty = sql`(${field} IS NULL OR ${field} IN ('null'::jsonb, '""'::jsonb, '[]'::jsonb))`;
  switch (predicate.op) {
    case "overlaps":
      if (!Array.isArray(predicate.value)) return sql`false`;
      return sql`jsonb_typeof(${field}) = 'array' AND ${field} @> ANY(ARRAY(
        SELECT jsonb_build_array(member.value) FROM jsonb_array_elements(${json(predicate.value)}) AS member(value)
      ))`;
    case "containsAll":
      return sql`jsonb_typeof(${field}) = 'array' AND ${field} @> ${json(predicate.value)}`;
    case "hasKey":
      return sql`${field} ? ${projectionKey(String(predicate.value))}`;
    case "exists":
      return sql`${field} IS NOT NULL`;
    case "missing":
      return sql`${field} IS NULL`;
    case "empty":
      return empty;
    case "notEmpty":
      return sql`NOT ${empty}`;
    case "eq":
      return fieldEqualitySql(index, predicate.field, comparable, valueJson(predicate.value));
    case "ne":
      return sql`${comparable} <> ${valueJson(predicate.value)}`;
    case "equalsIgnoreCase":
      return sql`${stringBytesSql(field, true)} = decode(${projectionSubstringBytes(String(predicate.value).toLowerCase())}, 'hex')`;
    case "in":
      return inListSql(
        predicate.value,
        comparable,
        Boolean(index.equality?.includes(predicate.field) && localField(index, predicate.field)),
        projectedString ? expressionComparable : (item) => item,
      );
    case "notIn":
      return predicate.value.length
        ? sql`${comparable} NOT IN (${sql.join(predicate.value.map(valueJson), sql`, `)})`
        : sql`true`;
    case "textContains": {
      const value =
        queryField(index, predicate.field).type === "number" ? sql`to_jsonb(${recordNumberTextSql(field)})` : field;
      return recordTextMatch(value, String(predicate.value), index.hierarchy?.breadcrumbField === predicate.field);
    }
    case "contains": {
      if (queryField(index, predicate.field).type === "array") return sql`${field} @> ${json([predicate.value])}`;
      return recordTextMatch(field, String(predicate.value), index.hierarchy?.breadcrumbField === predicate.field);
    }
    default: {
      if (predicate.value === null) return sql`false`;
      const operators = { gt: ">", gte: ">=", lt: "<", lte: "<=" };
      return sql`${sortFieldSql(index, predicate.field, alias, resolve, owner)} ${sql.raw(operators[predicate.op])} ${sortValueSql(predicate.value)}`;
    }
  }
};

export { pageAfterSql, pageOrderSql, recordPageSql } from "./record-query-page";

const conditionalFieldSql = (
  index: StorageRecordIndex,
  name: string,
  alias?: string,
  resolve?: (name: string) => StorageRecordIndex,
  owner?: QuerySqlOwner,
) => {
  const field = queryField(index, name);
  if (!field.cases) throw new Error("Conditional field declaration required");

  const outer = alias ?? "storage_current_records";
  const conditionOwner = owner ?? {
    workbenchId: column("workbench_id", outer),
    extensionId: column("extension_id", outer),
  };
  const indexFor =
    resolve ??
    (() => {
      throw new Error("Conditional field needs installed indexes");
    });
  const cases: SQL[] = field.cases.map(
    (entry) =>
      sql`WHEN ${relatedRecordPredicateSql(conditionOwner, index, entry.when, indexFor, outer)} THEN ${json(entry.value)}`,
  );
  return typedComputedFieldSql(sql`(CASE ${sql.join(cases, sql` `)} ELSE ${json(field.otherwise ?? null)} END)`, field);
};
