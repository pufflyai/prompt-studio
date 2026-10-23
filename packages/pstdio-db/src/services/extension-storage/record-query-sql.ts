import { type SQL, sql } from "drizzle-orm";
import { queryField } from "pstdio-sync";
import type { Json, StoragePredicate, StorageRecordIndex } from "pstdio-sync-contracts";
import { recordNumberTextSql } from "./record-number-text";
import {
  encodeProjectionValue,
  projectionBytesTag,
  projectionFoldedTag,
  projectionKey,
  projectionStringBytes,
  projectionStringTag,
  projectionSubstringBytes,
} from "./record-projection-codec";

export const sqlLiteral = (value: string) => sql.raw(`'${value.replaceAll("'", "''")}'`);
const json = (value: Json) => sql`${JSON.stringify(encodeProjectionValue(value))}::jsonb`;
const stringBytesSql = (value: SQL, folded = false) => {
  const tag = folded ? projectionFoldedTag : projectionBytesTag;
  const text = sql`(${value} #>> '{}')`;
  const normalized = folded ? sql`lower(${text})` : text;
  // decode is immutable for expression indexes; protect literal backslashes.
  const bytes = sql`decode(replace(${normalized}, ${sqlLiteral("\\")}, ${sqlLiteral("\\\\")}), 'escape')`;
  return sql`(CASE WHEN jsonb_typeof(${value}) = 'object' AND ${value} ? ${sqlLiteral(projectionStringTag)}
    THEN decode(${value} ->> ${sqlLiteral(tag)}, 'hex')
    ELSE ${bytes} END)`;
};
const sortValueSql = (value: Json) =>
  typeof value === "string" ? sql`decode(${projectionStringBytes(value)}, 'hex')` : json(value);
export const recordScopeSql = (owner: { workbenchId: string; extensionId: string }, index: StorageRecordIndex) =>
  sql`workbench_id = ${sqlLiteral(owner.workbenchId)} AND extension_id = ${sqlLiteral(owner.extensionId)}
    AND NOT deleted ${index.prefix === undefined ? sql`` : sql`AND starts_with(record_id, ${sqlLiteral(index.prefix)})`}`;
export const recordFieldSql = (index: StorageRecordIndex, name: string) => {
  const field = queryField(index, name);
  const path = field.path.map((part) => sqlLiteral(projectionKey(part)));
  const value = sql`(value #> ARRAY[${sql.join(path, sql`, `)}]::text[])`;
  const parents = path.map(
    (_, position) =>
      sql`jsonb_typeof(value #> ARRAY[${sql.join(path.slice(0, position), sql`, `)}]::text[]) = 'object'`,
  );
  const type = field.type === "array" ? "array" : field.type;
  const validArray =
    field.type === "array"
      ? sql`AND NOT jsonb_path_exists(${value}, ${sqlLiteral(`$[*] ? (@.type() != "string" && !exists(@.${JSON.stringify(projectionStringTag)}))`)})`
      : sql``;
  const encodedString = field.type === "string" ? sql`OR ${value} ? ${sqlLiteral(projectionStringTag)}` : sql``;
  return sql`(CASE WHEN (${sql.join(parents, sql` AND `)}) AND (${value} = 'null'::jsonb OR (jsonb_typeof(${value}) = ${sqlLiteral(type)} ${validArray}) ${encodedString}) THEN ${value} ELSE NULL END)`;
};
export const sortFieldSql = (index: StorageRecordIndex, name: string) => {
  const value = sql`nullif(${recordFieldSql(index, name)}, 'null'::jsonb)`;
  return queryField(index, name).type === "string" ? stringBytesSql(value) : value;
};

export const arrayIndexFields = (index: StorageRecordIndex) =>
  Object.entries(index.fields).filter(([, field]) => field.type === "array");

const equalityKey = (value: SQL) => sql`md5((${value})::text)`;
const equalityPredicate = (index: StorageRecordIndex, field: string, comparable: SQL, value: Json) =>
  index.equality?.includes(field)
    ? sql`(${equalityKey(comparable)} = ${equalityKey(json(value))} AND ${comparable} = ${json(value)})`
    : sql`${comparable} = ${json(value)}`;
const orderingPrefix = (index: StorageRecordIndex, name: string) =>
  sql`substring(${sortFieldSql(index, name)} from 1 for ${sql.raw(String(Math.max(1, Math.floor(1024 / (index.orderBy?.length || 1)))))})`;

export const recordIndexKeys = (index: StorageRecordIndex) => {
  const keys: SQL[] = (index.equality ?? []).map(
    (field) => sql`(${equalityKey(sql`coalesce(${recordFieldSql(index, field)}, 'null'::jsonb)`)})`,
  );
  for (const sort of index.orderBy ?? [])
    keys.push(
      sql`(${queryField(index, sort.field).type === "string" ? orderingPrefix(index, sort.field) : sortFieldSql(index, sort.field)}) ${sql.raw(sort.direction)} NULLS LAST`,
    );
  keys.push(sql`record_id COLLATE "C"`);
  return keys;
};

export const predicateSql = (index: StorageRecordIndex, predicate?: StoragePredicate) => {
  if (!predicate) return sql`true`;
  // Missing typed values fail comparisons; negation must complement that false result.
  if ("not" in predicate) {
    const child: SQL = predicateSql(index, predicate.not);
    return sql`NOT coalesce(${child}, false)`;
  }
  if ("all" in predicate) {
    const parts: SQL[] = [];
    for (const child of predicate.all) parts.push(predicateSql(index, child));
    return parts.length ? sql`(${sql.join(parts, sql` AND `)})` : sql`true`;
  }
  if ("any" in predicate) {
    const parts: SQL[] = [];
    for (const child of predicate.any) parts.push(predicateSql(index, child));
    return parts.length ? sql`(${sql.join(parts, sql` OR `)})` : sql`false`;
  }
  return fieldPredicateSql(index, predicate);
};

const fieldPredicateSql = (index: StorageRecordIndex, predicate: Extract<StoragePredicate, { field: string }>) => {
  const field = recordFieldSql(index, predicate.field);
  const comparable = sql`coalesce(${field}, 'null'::jsonb)`;
  const empty = sql`(${field} IS NULL OR ${field} IN ('null'::jsonb, '""'::jsonb, '[]'::jsonb))`;
  switch (predicate.op) {
    case "exists":
      return sql`${field} IS NOT NULL`;
    case "missing":
      return sql`${field} IS NULL`;
    case "empty":
      return empty;
    case "notEmpty":
      return sql`NOT ${empty}`;
    case "eq":
      return equalityPredicate(index, predicate.field, comparable, predicate.value);
    case "ne":
      return sql`${comparable} <> ${json(predicate.value)}`;
    case "equalsIgnoreCase":
      return sql`${stringBytesSql(field, true)} = decode(${projectionSubstringBytes(String(predicate.value).toLowerCase())}, 'hex')`;
    case "in":
      return predicate.value.length
        ? sql`(${sql.join(
            predicate.value.map((value) => equalityPredicate(index, predicate.field, comparable, value)),
            sql` OR `,
          )})`
        : sql`false`;
    case "notIn":
      return predicate.value.length
        ? sql`${comparable} NOT IN (${sql.join(predicate.value.map(json), sql`, `)})`
        : sql`true`;
    case "textContains": {
      const value =
        queryField(index, predicate.field).type === "number" ? sql`to_jsonb(${recordNumberTextSql(field)})` : field;
      return sql`position(decode(${projectionSubstringBytes(String(predicate.value).toLowerCase())}, 'hex') in ${stringBytesSql(value, true)}) > 0`;
    }
    case "contains": {
      if (queryField(index, predicate.field).type === "array") return sql`${field} @> ${json([predicate.value])}`;
      return sql`position(decode(${projectionSubstringBytes(String(predicate.value).toLowerCase())}, 'hex') in ${stringBytesSql(field, true)}) > 0`;
    }
    default: {
      if (predicate.value === null) return sql`false`;
      const operators = { gt: ">", gte: ">=", lt: "<", lte: "<=" };
      return sql`${sortFieldSql(index, predicate.field)} ${sql.raw(operators[predicate.op])} ${sortValueSql(predicate.value)}`;
    }
  }
};

export const pageOrderSql = (index: StorageRecordIndex) =>
  sql.join(
    [
      ...(index.orderBy ?? []).flatMap((sort) => {
        const full = sql`${sortFieldSql(index, sort.field)} ${sql.raw(sort.direction)} NULLS LAST`;
        return queryField(index, sort.field).type === "string"
          ? [sql`${orderingPrefix(index, sort.field)} ${sql.raw(sort.direction)} NULLS LAST`, full]
          : [full];
      }),
      sql`record_id COLLATE "C" ASC`,
    ],
    sql`, `,
  );

export const recordPageSql = (index: StorageRecordIndex, fields: string[], where: SQL, limit: number, offset = 0) => {
  const selected = fields.flatMap((name) => [
    sqlLiteral(projectionKey(name)),
    sql`coalesce(${recordFieldSql(index, name)}, 'null'::jsonb)`,
  ]);
  const sort = (index.orderBy ?? []).map((sort) => sql`coalesce(${recordFieldSql(index, sort.field)}, 'null'::jsonb)`);
  return sql`
    SELECT record_id, revision,
      jsonb_build_object(${sql.join(selected, sql`, `)}) AS fields,
      jsonb_build_array(${sql.join(sort, sql`, `)}) AS sort_values
    FROM storage_current_records
    WHERE ${where}
    ORDER BY ${pageOrderSql(index)} LIMIT ${limit} OFFSET ${offset}`;
};

export const pageAfterSql = (index: StorageRecordIndex, after?: { recordId: string; values: Json[] }) => {
  if (!after) return sql`true`;
  const equal: SQL[] = [];
  const alternatives: SQL[] = [];
  for (const [position, sort] of (index.orderBy ?? []).entries()) {
    const field = sortFieldSql(index, sort.field);
    const value = after.values[position];
    if (value !== null) {
      const direction = sort.direction === "asc" ? sql`>` : sql`<`;
      alternatives.push(
        sql`(${sql.join([...equal, sql`(${field} ${direction} ${sortValueSql(value)} OR ${field} IS NULL)`], sql` AND `)})`,
      );
    }
    equal.push(sql`${field} IS NOT DISTINCT FROM ${value === null ? sql`NULL` : sortValueSql(value)}`);
  }
  alternatives.push(sql`(${sql.join([...equal, sql`record_id COLLATE "C" > ${after.recordId}`], sql` AND `)})`);
  return sql`(${sql.join(alternatives, sql` OR `)})`;
};
