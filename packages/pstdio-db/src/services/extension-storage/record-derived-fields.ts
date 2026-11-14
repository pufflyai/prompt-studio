import { and, eq, sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import { typedFieldValue } from "pstdio-sync/records";
import type { Json, StorageRecordIndex } from "pstdio-sync-contracts";
import type { DbClient } from "../../db/connection.pglite";
import { storage_current_records as current, storage_record_indexes as indexes } from "../../db/schemas.pg";
import { decodeProjectionValue, encodeProjectionValue } from "./record-projection-codec";

export const hasDerivedQueryFields = (definitions: StorageRecordIndex[]) =>
  definitions.some((index) => Object.values(index.fields).some((field) => field.derive));

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
  definitions: StorageRecordIndex[],
) => {
  let after: string | undefined;
  for (;;) {
    const rows = await tx
      .select({ recordId: current.record_id, value: current.value, deleted: current.deleted })
      .from(current)
      .where(
        and(
          eq(current.workbench_id, owner.workbenchId),
          eq(current.extension_id, owner.extensionId),
          after === undefined ? undefined : sql`${current.record_id} COLLATE "C" > ${after}`,
        ),
      )
      .orderBy(sql`${current.record_id} COLLATE "C"`)
      .limit(100);
    if (!rows.length) return;
    const input = rows.map((row) => ({
      record_id: row.recordId,
      query_values: encodeProjectionValue(
        derivedQueryValues(definitions, {
          ...row,
          value: decodeProjectionValue(row.value ?? null),
        }),
      ),
    }));
    await tx.execute(sql`UPDATE storage_current_records AS target SET query_values = input.query_values
      FROM jsonb_to_recordset(${JSON.stringify(input)}::jsonb) AS input(record_id text, query_values jsonb)
      WHERE target.workbench_id = ${owner.workbenchId} AND target.extension_id = ${owner.extensionId}
        AND target.record_id = input.record_id AND target.query_values IS DISTINCT FROM input.query_values`);
    after = rows.at(-1)!.recordId;
  }
};
