import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { coreOwnerId, type NumberedResource, type StorageOwner } from "pstdio-sync";
import type { StorageRecord } from "pstdio-sync-contracts";
import type { DbClient } from "../../db/connection.pglite";
import {
  storage_resource_aliases as aliases,
  storage_resource_identities as identities,
  storage_resource_projections as projections,
} from "../../db/schemas.pg";
import { jsonBatches } from "./json-batches";

export type NumberRecord = NumberedResource & { aliases: string[] };
type Transaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];

export const numberValue = (record: StorageRecord) => record.value as unknown as NumberRecord;

/** Both indexes include numeric values: a large former alias must never be allocated again. */
export const nextIndexedNumber = async (tx: Pick<DbClient, "select">, projectId: string, prefix: string, floor = 0) => {
  const highest = async (table: typeof identities | typeof aliases) => {
    const [row] = await tx
      .select({ value: table.value })
      .from(table)
      .where(and(eq(table.workbench_id, projectId), eq(table.prefix, prefix)))
      .orderBy(desc(table.value))
      .limit(1);
    return row?.value ?? 0;
  };
  return Math.max(floor, await highest(identities), await highest(aliases)) + 1;
};

/** Maintained in the same transaction as the canonical core records, for local and remote writes. */
export const projectNumberRecords = async (
  tx: Transaction,
  owner: StorageOwner,
  records: StorageRecord[],
  revision: number,
) => {
  if (owner.extensionId !== coreOwnerId || !records.length) return;
  await tx
    .insert(projections)
    .values({ workbench_id: owner.workbenchId, document_id: "records", revision })
    .onConflictDoUpdate({ target: projections.workbench_id, set: { document_id: "records", revision } });
  const ids = records.map((record) => record.recordId);
  for (let offset = 0; offset < ids.length; offset += 1_000) {
    const selected = ids.slice(offset, offset + 1_000);
    await tx
      .delete(aliases)
      .where(and(eq(aliases.workbench_id, owner.workbenchId), inArray(aliases.resource_id, selected)));
    await tx
      .delete(identities)
      .where(and(eq(identities.workbench_id, owner.workbenchId), inArray(identities.resource_id, selected)));
  }
  const live = records.filter((record) => record.exists && !record.deleted).map(numberValue);
  for (const batch of jsonBatches(
    live.map((r) => ({
      resource_id: r.id,
      extension_id: r.extensionId,
      kind: r.kind,
      prefix: r.prefix,
      value: r.value,
      shorthand: `${r.prefix}-${r.value}`,
    })),
  )) {
    await tx.execute(sql`INSERT INTO storage_resource_identities
      (workbench_id, resource_id, extension_id, kind, prefix, value, shorthand)
      SELECT ${owner.workbenchId}, i.resource_id, i.extension_id, i.kind, i.prefix, i.value, i.shorthand
      FROM jsonb_to_recordset(${batch}::jsonb) AS i(resource_id text, extension_id text, kind text, prefix text, value bigint, shorthand text)`);
  }
  for (const batch of jsonBatches(
    live.flatMap((r) =>
      [...new Set(r.aliases)].map((shorthand) => {
        const separator = shorthand.lastIndexOf("-");
        return {
          resource_id: r.id,
          shorthand,
          prefix: shorthand.slice(0, separator),
          value: Number(shorthand.slice(separator + 1)),
        };
      }),
    ),
  )) {
    await tx.execute(sql`INSERT INTO storage_resource_aliases (workbench_id, resource_id, shorthand, prefix, value)
      SELECT ${owner.workbenchId}, i.resource_id, i.shorthand, i.prefix, i.value
      FROM jsonb_to_recordset(${batch}::jsonb) AS i(resource_id text, shorthand text, prefix text, value bigint)`);
  }
};

/** Only collision keys touched by this write are examined. Ordinary saves never scan the owner. */
export const numberCollisions = async (tx: Transaction, owner: StorageOwner, records: StorageRecord[]) => {
  if (owner.extensionId !== coreOwnerId) return [];
  const keys = [
    ...new Map(
      records
        .filter((record) => record.exists && !record.deleted)
        .map(numberValue)
        .map((r) => [JSON.stringify([r.extensionId, r.kind, r.prefix, r.value]), r]),
    ).values(),
  ];
  const rows: (typeof identities.$inferSelect)[] = [];
  for (const batch of jsonBatches(
    keys.map((r) => ({ extension_id: r.extensionId, kind: r.kind, shorthand: `${r.prefix}-${r.value}` })),
  )) {
    const result = await tx.execute(sql`SELECT i.* FROM storage_resource_identities i
      INNER JOIN (SELECT DISTINCT extension_id, kind, shorthand FROM jsonb_to_recordset(${batch}::jsonb)
        AS k(extension_id text, kind text, shorthand text)) k
      USING (extension_id, kind, shorthand)
      WHERE i.workbench_id = ${owner.workbenchId}
      AND EXISTS (SELECT 1 FROM storage_resource_identities other
        WHERE other.workbench_id = i.workbench_id AND other.extension_id = i.extension_id
        AND other.kind = i.kind AND other.shorthand = i.shorthand
        AND other.resource_id COLLATE "C" < i.resource_id COLLATE "C")
      ORDER BY i.resource_id COLLATE "C"`);
    rows.push(...(result.rows as typeof rows));
  }
  return [...new Map(rows.map((row) => [row.resource_id, row])).values()].sort((a, b) =>
    a.resource_id < b.resource_id ? -1 : 1,
  );
};
