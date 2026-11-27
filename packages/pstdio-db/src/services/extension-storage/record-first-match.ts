import { type SQL, sql } from "drizzle-orm";
import type { StorageRecordIndex } from "pstdio-sync-contracts";
import type { DbClient } from "../../db/connection.pglite";
import { expressionArray } from "./query-expression-values";

/** One scope per query, including queries nested in a larger records transaction.
 * PostgreSQL owns scratch storage and truncates it when the outer transaction commits. */
export const createFirstRecordLookups = (indexedDeclarations: ReadonlySet<string> = new Set()) => {
  const slots = new WeakMap<StorageRecordIndex, Map<string, string>>();
  const pending: SQL[] = [];
  let prepared = false;
  const firstRecordByField = (
    index: StorageRecordIndex,
    name: string,
    alias: string,
    source: SQL,
    array: boolean,
    read: (alias: string) => SQL,
    scope: (alias: string) => SQL,
  ) => {
    // Physical host and legacy equality keys can already seek straight to the matching rows.
    if (indexedDeclarations.has(index.name) && index.equality?.includes(name)) return;
    const field = index.fields[name];
    if (!field?.path || field.type !== "string" || field.lookup || field.expression || field.cases || field.format)
      return;
    if ([index.identity?.shorthandField, index.identity?.aliasesField, index.hierarchy?.breadcrumbField].includes(name))
      return;
    const fields = slots.get(index) ?? new Map<string, string>();
    let slot = fields.get(name);
    if (!slot) {
      slot = crypto.randomUUID();
      fields.set(name, slot);
      slots.set(index, fields);
      const key = read("candidate_row");
      pending.push(sql`INSERT INTO pg_temp.pstdio_query_matches (slot, digest, key, record_id)
        SELECT ${slot}::uuid, md5(first.key::text)::uuid, first.key, first.id FROM (
          SELECT ${key} AS key, min(candidate_row.record_id COLLATE "C") AS id FROM records AS candidate_row
          WHERE ${scope("candidate_row")} AND ${key} <> 'null'::jsonb GROUP BY 1
        ) first`);
    }
    // Digest bounds the index key for long Unicode strings. Full JSON equality resolves collisions.
    const lookup = (value: SQL) => sql`(SELECT m.record_id FROM pg_temp.pstdio_query_matches m
      WHERE m.slot=${slot}::uuid AND m.digest=md5((${value})::text)::uuid AND m.key=${value} LIMIT 1)`;
    const id = sql`${sql.identifier(alias)}.record_id`;
    return array
      ? sql`${id} = ANY(ARRAY(SELECT ${lookup(sql`member.value`)} FROM jsonb_array_elements(${expressionArray(source)}) member(value)))`
      : sql`${id} = ${lookup(source)}`;
  };
  const prepare = async (tx: Pick<DbClient, "execute">) => {
    if (!pending.length) return;
    if (!prepared) {
      // The records transaction queue serializes complete logical queries. Reset once per
      // query, preserving slots shared by its statistics, groups and totals.
      const table = await tx.execute(sql`SELECT to_regclass('pg_temp.pstdio_query_matches') AS name`);
      if (table.rows[0].name) {
        await tx.execute(sql`TRUNCATE pg_temp.pstdio_query_matches`);
      } else {
        await tx.execute(sql`CREATE TEMP TABLE pstdio_query_matches
          (slot uuid NOT NULL, digest uuid NOT NULL, key jsonb NOT NULL, record_id text NOT NULL) ON COMMIT DELETE ROWS`);
        await tx.execute(sql`CREATE INDEX pstdio_query_matches_seek ON pg_temp.pstdio_query_matches (slot, digest)`);
      }
      prepared = true;
    }
    for (const insert of pending) await tx.execute(insert);
    pending.length = 0;
  };
  return { firstRecordByField, prepare };
};
export type FirstRecordLookups = ReturnType<typeof createFirstRecordLookups>;

export const executeRecordQuery = async <T extends Record<string, unknown>>(
  tx: Pick<DbClient, "execute">,
  lookups: FirstRecordLookups | undefined,
  statement: SQL,
) => {
  await lookups?.prepare(tx);
  return tx.execute<T>(statement);
};
