import { and, eq, or, sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import { typedFieldValue } from "pstdio-sync/records";
import { canonicalJson, type Json, type StorageRecordIndex } from "pstdio-sync-contracts";
import type { DbClient } from "../../db/connection.pglite";
import { storage_current_records as current, storage_record_indexes as indexes } from "../../db/schemas.pg";
import { decodeProjectionValue, encodeProjectionValue, projectionKey } from "./record-projection-codec";
import type { StorageDiagnostics } from "./storage-diagnostics";

const derivedDefinitions = (definitions: StorageRecordIndex[]) =>
  new Map(
    definitions.flatMap((index) => {
      const fields = Object.fromEntries(Object.entries(index.fields).filter(([, field]) => field.derive));
      return Object.keys(fields).length
        ? [[index.name, { name: index.name, prefix: index.prefix, fields }] as const]
        : [];
    }),
  );

export const derivedQueryChanges = (previous: StorageRecordIndex[], next: StorageRecordIndex[]) => {
  const before = derivedDefinitions(previous);
  const after = derivedDefinitions(next);
  const names = [...new Set([...before.keys(), ...after.keys()])].filter(
    (name) =>
      canonicalJson((before.get(name) ?? null) as unknown as Json) !==
      canonicalJson((after.get(name) ?? null) as unknown as Json),
  );
  const changed = new Set(names);
  return {
    names,
    definitions: next.filter((index) => changed.has(index.name)),
    prefixes: names.flatMap((name) =>
      [before.get(name), after.get(name)].flatMap((index) => (index ? [index.prefix] : [])),
    ),
  };
};

export const readDerivedQueryIndexes = async (tx: Pick<DbClient, "select">, owner: StorageOwner) => {
  const rows = await tx
    .select({ definition: indexes.definition })
    .from(indexes)
    .where(
      and(
        eq(indexes.workbench_id, owner.workbenchId),
        eq(indexes.extension_id, owner.extensionId),
        sql`jsonb_path_exists(${indexes.definition}, '$.fields.*.derive')`,
      ),
    );
  return rows.map((row) => decodeProjectionValue(row.definition as unknown as Json) as unknown as StorageRecordIndex);
};

export const derivedQueryValues = (
  definitions: StorageRecordIndex[],
  record: { recordId: string; value: Json; deleted: boolean },
) => {
  const result: Record<string, Record<string, Json>> = {};
  if (record.deleted) return result;
  for (const index of definitions) {
    if (index.prefix !== undefined && !record.recordId.startsWith(index.prefix)) continue;
    const fields = Object.entries(index.fields).flatMap(([name, field]) => {
      if (!field.derive) return [];
      const value = typedFieldValue(record.value, field);
      return value === undefined ? [] : [[name, value] as const];
    });
    if (fields.length)
      Object.defineProperty(result, index.name, { value: Object.fromEntries(fields), enumerable: true });
  }
  return result;
};

/** One-time index installation processes bounded canonical projection pages; view reads never rebuild these. */
export const rebuildDerivedQueryValues = async (
  tx: Pick<DbClient, "select" | "execute">,
  owner: StorageOwner,
  changes: ReturnType<typeof derivedQueryChanges>,
  diagnostics?: StorageDiagnostics,
) => {
  if (!changes.names.length) return;
  const scope = changes.prefixes.includes(undefined)
    ? undefined
    : or(...changes.prefixes.map((prefix) => sql`starts_with(${current.record_id}, ${prefix!})`));
  const removed = sql`ARRAY[${sql.join(
    changes.names.map((name) => sql`${projectionKey(name)}`),
    sql`, `,
  )}]::text[]`;
  let after: string | undefined;
  for (;;) {
    const rows = await tx
      .select({ recordId: current.record_id, value: current.value, deleted: current.deleted })
      .from(current)
      .where(
        and(
          eq(current.workbench_id, owner.workbenchId),
          eq(current.extension_id, owner.extensionId),
          scope,
          after === undefined ? undefined : sql`${current.record_id} COLLATE "C" > ${after}`,
        ),
      )
      .orderBy(sql`${current.record_id} COLLATE "C"`)
      .limit(100);
    if (!rows.length) return;
    diagnostics?.({ phase: "index-records-read", owner, records: rows.length });
    const input = rows.map((row) => ({
      record_id: row.recordId,
      query_values: encodeProjectionValue(
        derivedQueryValues(changes.definitions, {
          ...row,
          value: decodeProjectionValue(row.value ?? null),
        }),
      ),
    }));
    const merged = sql`(target.query_values - ${removed}) || input.query_values`;
    await tx.execute(sql`UPDATE storage_current_records AS target SET query_values = ${merged}
      FROM jsonb_to_recordset(${JSON.stringify(input)}::jsonb) AS input(record_id text, query_values jsonb)
      WHERE target.workbench_id = ${owner.workbenchId} AND target.extension_id = ${owner.extensionId}
        AND target.record_id = input.record_id AND target.query_values IS DISTINCT FROM (${merged})`);
    after = rows.at(-1)!.recordId;
  }
};
