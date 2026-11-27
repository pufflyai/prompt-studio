import { type SQL, sql } from "drizzle-orm";
import type { StorageIndexField, StorageRecordIndex } from "pstdio-sync-contracts";
import { expressionArray, expressionComparable } from "./query-expression-values";

import type { FirstRecordLookups } from "./record-first-match";

export const recordLookupSql = (
  lookups: FirstRecordLookups | undefined,
  source: StorageRecordIndex,
  field: StorageIndexField,
  alias: string,
  resolve: (name: string) => StorageRecordIndex,
  read: (index: StorageRecordIndex, name: string, alias: string) => SQL,
  scope: (index: StorageRecordIndex, alias: string) => SQL,
  equal: (index: StorageRecordIndex, name: string, left: SQL, right: SQL) => SQL,
) => {
  const lookup = field.lookup!;
  const target = resolve(lookup.index);
  const targetAlias = `${alias}_lookup`;
  const matches = lookup.on.map((join) => {
    const left = read(source, join.sourceField, alias);
    const right = read(target, join.relatedField, targetAlias);
    let match = equal(
      target,
      join.relatedField,
      sql`coalesce(${right}, 'null'::jsonb)`,
      sql`coalesce(${left}, 'null'::jsonb)`,
    );
    if (source.identity?.shorthandField === join.sourceField || source.hierarchy?.breadcrumbField === join.sourceField)
      match = sql`${expressionComparable(left)} = ${expressionComparable(right)}`;
    if (join.op === "contains") {
      const identity =
        source.identity?.shorthandField === join.sourceField || target.identity?.shorthandField === join.relatedField;
      if (identity)
        match = sql`EXISTS (SELECT 1 FROM jsonb_array_elements(${expressionArray(left)}) AS lookup_member(value) WHERE ${expressionComparable(sql`lookup_member.value`)} = ${expressionComparable(right)})`;
      else {
        const members = sql`jsonb_array_elements(${expressionArray(left)}) AS lookup_member(value)`;
        const probe = target.equality?.includes(join.relatedField)
          ? sql`md5((coalesce(${right}, 'null'::jsonb))::text) = ANY (ARRAY(SELECT md5((lookup_member.value)::text) FROM ${members}))`
          : sql`${right} = ANY (ARRAY(SELECT lookup_member.value FROM ${members}))`;
        match = sql`${probe} AND ${left} @> jsonb_build_array(${right})`;
      }
    }
    if (join.op === "containedBy")
      match = sql`EXISTS (SELECT 1 FROM jsonb_array_elements(${expressionArray(right)}) AS lookup_member(value) WHERE ${expressionComparable(sql`lookup_member.value`)} = ${expressionComparable(left)})`;
    return sql`${left} IS NOT NULL AND ${left} <> 'null'::jsonb AND ${right} IS NOT NULL AND ${right} <> 'null'::jsonb AND ${match}`;
  });
  const [join] = lookup.on;
  if (
    lookups &&
    lookup.on.length === 1 &&
    (join.op === undefined || join.op === "eq" || join.op === "contains") &&
    ![source.identity?.shorthandField, source.hierarchy?.breadcrumbField].includes(join.sourceField)
  ) {
    const probe = lookups.firstRecordByField(
      target,
      join.relatedField,
      targetAlias,
      read(source, join.sourceField, alias),
      join.op === "contains",
      (candidate) => read(target, join.relatedField, candidate),
      (candidate) => scope(target, candidate),
    );
    if (probe) matches.push(probe);
  }
  return sql`(SELECT ${read(target, lookup.field, targetAlias)} FROM records AS ${sql.identifier(targetAlias)}
    WHERE ${scope(target, targetAlias)} AND ${sql.join(matches, sql` AND `)}
    ORDER BY ${sql.identifier(targetAlias)}.record_id COLLATE "C" LIMIT 1)`;
};
