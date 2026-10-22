import { type SQL, sql } from "drizzle-orm";
import { queryField } from "pstdio-sync";
import type { Json, StoragePredicate, StorageRecordIndex } from "pstdio-sync-contracts";

export const sqlLiteral = (value: string) => sql.raw(`'${value.replaceAll("'", "''")}'`);
const json = (value: Json) => sql`${JSON.stringify(value)}::jsonb`;
export const recordFieldSql = (index: StorageRecordIndex, name: string) => {
  const field = queryField(index, name);
  const path = field.path.map(sqlLiteral);
  const value = sql`(value #> ARRAY[${sql.join(path, sql`, `)}]::text[])`;
  const type = field.type === "array" ? "array" : field.type;
  const validArray =
    field.type === "array" ? sql`AND NOT jsonb_path_exists(${value}, '$[*] ? (@.type() != "string")')` : sql``;
  return sql`(CASE WHEN ${value} = 'null'::jsonb OR (jsonb_typeof(${value}) = ${sqlLiteral(type)} ${validArray}) THEN ${value} ELSE NULL END)`;
};
export const sortFieldSql = (index: StorageRecordIndex, name: string) =>
  sql`nullif(${recordFieldSql(index, name)}, 'null'::jsonb)`;

export const arrayIndexFields = (index: StorageRecordIndex) =>
  Object.entries(index.fields).filter(([, field]) => field.type === "array");

export const recordIndexKeys = (index: StorageRecordIndex) => {
  const sorted = new Set(index.orderBy?.map((sort) => sort.field) ?? []);
  const equality =
    index.equality ??
    Object.keys(index.fields).filter((field) => !sorted.has(field) && index.fields[field].type !== "array");
  const keys: SQL[] = equality.map((field) => sql`(coalesce(${recordFieldSql(index, field)}, 'null'::jsonb))`);
  for (const sort of index.orderBy ?? [])
    keys.push(sql`(${sortFieldSql(index, sort.field)}) ${sql.raw(sort.direction)} NULLS LAST`);
  keys.push(sql`record_id COLLATE "C"`);
  return keys;
};

export const predicateSql = (index: StorageRecordIndex, predicate?: StoragePredicate) => {
  if (!predicate) return sql`true`;
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
      return sql`${comparable} = ${json(predicate.value)}`;
    case "ne":
      return sql`${comparable} <> ${json(predicate.value)}`;
    case "in":
      return predicate.value.length
        ? sql`${comparable} IN (${sql.join(predicate.value.map(json), sql`, `)})`
        : sql`false`;
    case "notIn":
      return predicate.value.length
        ? sql`${comparable} NOT IN (${sql.join(predicate.value.map(json), sql`, `)})`
        : sql`true`;
    case "contains": {
      if (queryField(index, predicate.field).type === "array") return sql`${field} @> ${json([predicate.value])}`;
      const value = String(predicate.value).replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
      return sql`(${field} #>> '{}') ILIKE ${`%${value}%`}`;
    }
    default: {
      if (predicate.value === null) return sql`false`;
      const operators = { gt: ">", gte: ">=", lt: "<", lte: "<=" };
      return sql`${sortFieldSql(index, predicate.field)} ${sql.raw(operators[predicate.op])} ${json(predicate.value)}`;
    }
  }
};

export const pageOrderSql = (index: StorageRecordIndex) =>
  sql.join(
    [
      ...(index.orderBy ?? []).map(
        (sort) => sql`${sortFieldSql(index, sort.field)} ${sql.raw(sort.direction)} NULLS LAST`,
      ),
      sql`record_id COLLATE "C" ASC`,
    ],
    sql`, `,
  );

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
        sql`(${sql.join([...equal, sql`(${field} ${direction} ${json(value)} OR ${field} IS NULL)`], sql` AND `)})`,
      );
    }
    equal.push(sql`${field} IS NOT DISTINCT FROM ${value === null ? sql`NULL` : json(value)}`);
  }
  alternatives.push(sql`(${sql.join([...equal, sql`record_id COLLATE "C" > ${after.recordId}`], sql` AND `)})`);
  return sql`(${sql.join(alternatives, sql` OR `)})`;
};
