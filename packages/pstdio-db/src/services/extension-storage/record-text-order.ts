import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { isLocaleQueryText, recordQueryTextOrders } from "pstdio-sync/records";
import type { Json, StorageRecordIndex } from "pstdio-sync-contracts";
import type { DbClient } from "../../db/connection.pglite";
import { projectionBytesTag, projectionStringTag } from "./record-projection-codec";
import { type QuerySqlOwner, recordFieldSql, sortFieldSql, sortValueSql, sqlLiteral } from "./record-query-sql";

const collation = (locale: string, natural = true) => {
  const resolved = new Intl.Collator(locale, {
    numeric: natural,
    sensitivity: natural ? "base" : "variant",
  }).resolvedOptions();
  const base = new Intl.Locale(resolved.locale).baseName;
  const custom = resolved.collation === "default" ? "" : `-co-${resolved.collation}`;
  const caseFirst = resolved.caseFirst === "false" ? "" : `-kf-${resolved.caseFirst}`;
  const icu = `${base}-u${custom}${caseFirst}-kn-${natural ? "true" : "false"}-ks-${natural ? "level1" : "level3"}`;
  return { locale: icu, name: `storage_text_sort_v1_${createHash("sha256").update(icu).digest("hex").slice(0, 24)}` };
};

/** ICU compares the viewer's text in SQL. The collation is disposable query infrastructure. */
export const prepareTextOrder = async (tx: Pick<DbClient, "execute">, index: StorageRecordIndex) => {
  const order = recordQueryTextOrders.get(index);
  if (!order) return;
  await prepareLocaleCollation(tx, order.locale, true);
};

export const prepareLocaleCollation = async (tx: Pick<DbClient, "execute">, viewerLocale: string, natural = false) => {
  const { name, locale } = collation(viewerLocale, natural);
  const existing = await tx.execute(sql`SELECT 1 FROM pg_collation WHERE collname = ${name}`);
  if (!existing.rows.length)
    await tx.execute(
      sql`CREATE COLLATION ${sql.identifier(name)} (provider = icu, locale = ${sqlLiteral(locale)}, deterministic = false)`,
    );
  const cached = await tx.execute<{ collname: string }>(sql`SELECT collname FROM pg_collation
    WHERE starts_with(collname, 'storage_text_sort_v1_') ORDER BY oid LIMIT 129`);
  if (cached.rows.length > 128) {
    const evicted = cached.rows.find(({ collname }) => collname !== name)!;
    await tx.execute(sql`DROP COLLATION ${sql.identifier(evicted.collname)}`);
  }
  return name;
};

const localeTextSafeSql = (value: ReturnType<typeof sql>) => sql`NOT (
  ${value} ? ${sqlLiteral(projectionStringTag)} AND
  (${value} ->> ${sqlLiteral(projectionBytesTag)}) ~ '^(..)*(00|ed[ab][0-9a-f][89ab][0-9a-f])'
)`;

export const projectionTextSql = (value: ReturnType<typeof sql>) => sql`CASE
  WHEN NOT ${localeTextSafeSql(value)} THEN NULL::text
  WHEN ${value} ? ${sqlLiteral(projectionStringTag)}
  THEN convert_from(decode(${value} ->> ${sqlLiteral(projectionBytesTag)}, 'hex'), 'UTF8') ELSE ${value} #>> '{}' END`;

export const orderedFieldPartsSql = (
  index: StorageRecordIndex,
  name: string,
  alias?: string,
  resolve?: (name: string) => StorageRecordIndex,
  owner?: QuerySqlOwner,
) => {
  const order = recordQueryTextOrders.get(index);
  if (order?.field !== name) return [sortFieldSql(index, name, alias, resolve, owner)];
  const value = recordFieldSql(index, name, alias, resolve, owner);
  const text = projectionTextSql(value);
  const safe = localeTextSafeSql(value);
  return [
    sql`CASE WHEN ${value} IS NULL OR ${value} = 'null'::jsonb THEN NULL WHEN ${safe} THEN 0 ELSE 1 END`,
    sql`(${text}) COLLATE ${sql.identifier(collation(order.locale).name)}`,
    sql`CASE WHEN ${safe} THEN NULL::bytea ELSE ${sortFieldSql(index, name, alias, resolve, owner)} END`,
  ];
};

export const orderedValuePartsSql = (index: StorageRecordIndex, field: string, value: Json) => {
  const order = recordQueryTextOrders.get(index);
  if (order?.field !== field) return [value === null ? null : sortValueSql(value)];
  if (typeof value !== "string") return [null, null, null];
  return isLocaleQueryText(value)
    ? [sql`0`, sql`${value} COLLATE ${sql.identifier(collation(order.locale).name)}`, null]
    : [sql`1`, null, sortValueSql(value)];
};

export const hasTextOrder = (index: StorageRecordIndex, field: string) =>
  recordQueryTextOrders.get(index)?.field === field;
