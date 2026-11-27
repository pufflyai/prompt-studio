import { type SQL, sql } from "drizzle-orm";
import { recordQueryTextOrders } from "pstdio-sync/records";
import type { StorageIndexField, StoragePredicate, StorageRecordIndex } from "pstdio-sync-contracts";
import type { QuerySqlOwner } from "./record-query-owner";

const shared = new WeakSet<StorageRecordIndex>();

const selectsKey = (where: StoragePredicate | undefined, key: string): boolean => {
  if (!where) return false;
  if ("field" in where) return where.field === key && (where.op === "eq" || where.op === "in");
  if ("all" in where) return where.all.some((part) => selectsKey(part, key));
  if ("any" in where) return where.any.length > 0 && where.any.every((part) => selectsKey(part, key));
  return false;
};

/** Broad SQL reads share related keys; bounded point projections retain their probes. */
export const createLookupSetIndex = (original: StorageRecordIndex, owner?: QuerySqlOwner, where?: StoragePredicate) => {
  if (typeof owner?.ownerId !== "number") return original;
  const key = original.identity?.idField ?? original.equality?.[0];
  if (key && selectsKey(where, key)) return original;
  const index = { ...original };
  const textOrder = recordQueryTextOrders.get(original);
  if (textOrder) recordQueryTextOrders.set(index, textOrder);
  shared.add(index);
  return index;
};

export const lookupSetRecordIdSql = (
  source: StorageRecordIndex,
  field: StorageIndexField,
  target: StorageRecordIndex,
  sourceAlias: string,
  read: (index: StorageRecordIndex, name: string, alias: string) => SQL,
  scope: (index: StorageRecordIndex, alias: string) => SQL,
) => {
  const joins = field.lookup!.on;
  if (!shared.has(source) || target.identity || joins.length !== 1) return;
  const join = joins[0];
  if ((join.op && join.op !== "eq") || !target.equality?.includes(join.relatedField)) return;
  const leftField = source.fields[join.sourceField];
  const rightField = target.fields[join.relatedField];
  if (
    leftField.type !== "string" ||
    rightField.type !== "string" ||
    rightField.lookup ||
    rightField.expression ||
    rightField.cases ||
    rightField.format ||
    join.sourceField === source.identity?.shorthandField ||
    join.sourceField === source.identity?.aliasesField ||
    join.sourceField === source.hierarchy?.breadcrumbField ||
    join.relatedField === target.hierarchy?.breadcrumbField
  )
    return;
  const alias = "lookup_set_records";
  const right = read(target, join.relatedField, alias);
  const left = read(source, join.sourceField, sourceAlias);
  // Only keys and IDs enter the initplan. A value expression may have an execution
  // guard, so evaluate it later for the selected first record, never for other matches.
  const keys = sql`(SELECT jsonb_object_agg(lookup_keys.key, lookup_keys.id) FROM (
    SELECT (${right})::text AS key, min(${sql.identifier(alias)}.record_id COLLATE "C") AS id
    FROM records AS ${sql.identifier(alias)} WHERE ${scope(target, alias)}
      AND ${right} IS NOT NULL AND ${right} <> 'null'::jsonb
    GROUP BY ${right}
  ) AS lookup_keys)`;
  return sql`(${keys} ->> (${left})::text)`;
};
