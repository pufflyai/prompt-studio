import { and, eq, gt, isNotNull, isNull, or, sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import type { DbClient } from "../../db/connection.pglite";
import { storage_personal_history as rows } from "../../db/schemas.pg";
import type { PersonalIndexDelta } from "./personal-history-index";

export type PersonalIndexTransaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];
export const personalIndexAddress = (owner: StorageOwner) => ({
  workbench_id: owner.workbenchId,
  extension_id: owner.extensionId,
});
const pendingIndexOrder = (owner: StorageOwner, sourceId: string | undefined, pendingId: string) => {
  if (sourceId === undefined) return;
  return sql`NOT EXISTS (
          SELECT 1 FROM storage_log_entries candidate
          INNER JOIN storage_log_entries newer
            ON newer.workbench_id = candidate.workbench_id AND newer.extension_id = candidate.extension_id
              AND newer.log_name = candidate.log_name AND newer.scope = candidate.scope AND newer.stream = candidate.stream
          WHERE candidate.workbench_id = ${owner.workbenchId} AND candidate.extension_id = ${owner.extensionId}
            AND candidate.log_name = 'index' AND candidate.scope = 'project' AND candidate.stream = ${sourceId}
            AND candidate.entry_id = ${pendingId} AND newer.entry_id = ${rows.pending_id}
            AND newer.local_sequence > candidate.local_sequence
        )`;
};
export const applyPersonalIndexRows = async (
  tx: PersonalIndexTransaction,
  owner: StorageOwner,
  changes: { delta: PersonalIndexDelta; pendingId?: string; settledId?: string }[],
  sourceId?: string,
) => {
  const changed: (typeof rows.$inferSelect)[] = [];
  for (const { delta, pendingId, settledId } of changes) {
    const samePending = settledId ? eq(rows.pending_id, settledId) : undefined;
    const precedence = delta.seedId
      ? and(
          isNotNull(rows.seed_id),
          or(gt(rows.seed_id, delta.seedId), and(eq(rows.seed_id, delta.seedId), samePending)),
        )
      : undefined;
    const overlay = pendingId
      ? pendingIndexOrder(owner, sourceId, pendingId)
      : or(
          isNull(rows.pending_id),
          samePending,
          delta.seedId ? gt(rows.seed_id, delta.seedId) : isNotNull(rows.seed_id),
        );
    const returned = await tx
      .insert(rows)
      .values({
        ...personalIndexAddress(owner),
        device_id: delta.deviceId,
        kind: delta.kind,
        record_id: delta.id,
        value: delta.value,
        seed_id: delta.seedId ?? null,
        pending_id: pendingId ?? null,
      })
      .onConflictDoUpdate({
        target: [rows.workbench_id, rows.extension_id, rows.kind, rows.device_id, rows.record_id],
        set: { value: delta.value, seed_id: delta.seedId ?? null, pending_id: pendingId ?? null },
        setWhere: and(
          precedence,
          overlay,
          or(
            delta.value === null
              ? isNotNull(rows.value)
              : sql`${rows.value} IS DISTINCT FROM ${JSON.stringify(delta.value)}::jsonb`,
            sql`${rows.seed_id} IS DISTINCT FROM ${delta.seedId ?? null}`,
            sql`${rows.pending_id} IS DISTINCT FROM ${pendingId ?? null}`,
          ),
        ),
      })
      .returning();
    changed.push(...returned);
  }
  return changed;
};
