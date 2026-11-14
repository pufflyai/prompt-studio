import { type SQL, sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import { relatedQueryIndexes } from "pstdio-sync/records";
import type { StoragePredicate, StorageRecordIndex } from "pstdio-sync-contracts";
import { predicateSql, recordEqualitySql, recordFieldSql, recordScopeSql } from "./record-query-sql";

export const loadRelatedQueryIndexes = async (
  where: StoragePredicate | undefined,
  read: (name: string) => Promise<StorageRecordIndex>,
) => {
  const definitions = new Map<string, StorageRecordIndex>();
  for (const name of relatedQueryIndexes(where)) definitions.set(name, await read(name));
  return (name: string) => {
    const index = definitions.get(name);
    if (!index) throw new Error(`Storage index not installed: ${name}`);
    return index;
  };
};

/** Correlation stays in SQL; both endpoints are constrained to the caller before selection. */
export const relatedRecordPredicateSql = (
  owner: StorageOwner,
  index: StorageRecordIndex,
  where: StoragePredicate | undefined,
  indexFor: (name: string) => StorageRecordIndex,
) => {
  const compile = (
    source: StorageRecordIndex,
    predicate: StoragePredicate | undefined,
    alias: string,
    depth: number,
  ) => {
    const result: SQL = predicateSql(
      source,
      predicate,
      (outer, selection) => {
        const target = indexFor(selection.index);
        const targetAlias = `related_${depth}`;
        const joins = selection.on.map((join) => {
          const left = recordFieldSql(outer, join.sourceField, alias);
          const right = recordFieldSql(target, join.relatedField, targetAlias);
          // Null/missing joins have no relationship. Typed JSON equality preserves encoded strings.
          return sql`(${left} IS NOT NULL AND ${left} <> 'null'::jsonb AND ${recordEqualitySql(target, join.relatedField, sql`coalesce(${right}, 'null'::jsonb)`, sql`coalesce(${left}, 'null'::jsonb)`)})`;
        });
        return sql`EXISTS (SELECT 1 FROM storage_current_records AS ${sql.identifier(targetAlias)}
        WHERE ${recordScopeSql(owner, target, targetAlias)} AND ${sql.join(joins, sql` AND `)}
        AND ${compile(target, selection.where, targetAlias, depth + 1)})`;
      },
      alias,
    );
    return result;
  };
  return compile(index, where, "storage_current_records", 0);
};
