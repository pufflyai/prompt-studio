import { and, eq, gt, isNotNull, isNull, or, sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import type { DbClient } from "../../db/connection.pglite";
import { storage_personal_history as rows } from "../../db/schemas.pg";
import { logStreamKey } from "./ordered-log-sql";
import type { PersonalIndexDelta } from "./personal-history-index";
import { personalIndexKey, personalIndexPages } from "./personal-index-pages";
import { storageOwnerKey } from "./storage-owner-key";

export type PersonalIndexTransaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];
export const personalIndexAddress = (owner: StorageOwner) => ({
  owner_id: storageOwnerKey(owner),
});
const pendingIndexOrder = (owner: StorageOwner, sourceId: string | undefined, pendingId: string) => {
  if (sourceId === undefined) return;
  return sql`NOT EXISTS (
          SELECT 1 FROM log_entries candidate
          INNER JOIN log_entries newer ON newer.stream_id = candidate.stream_id
          WHERE candidate.stream_id = ${logStreamKey({ owner, name: "index", scope: "project", stream: sourceId, writerId: sourceId })}
            AND candidate.entry_id = ${pendingId} AND newer.entry_id = ${rows.pending_id}
            AND newer.local_sequence > candidate.local_sequence
        )`;
};
interface Change {
  delta: PersonalIndexDelta;
  pendingId?: string;
  settledId?: string;
}
const updatePersonalIndexRow = (
  tx: PersonalIndexTransaction,
  owner: StorageOwner,
  { delta, pendingId, settledId }: Change,
  sourceId?: string,
) => {
  const samePending = settledId ? eq(rows.pending_id, settledId) : undefined;
  const precedence = delta.seedId
    ? and(isNotNull(rows.seed_id), or(gt(rows.seed_id, delta.seedId), and(eq(rows.seed_id, delta.seedId), samePending)))
    : undefined;
  const overlay = pendingId
    ? pendingIndexOrder(owner, sourceId, pendingId)
    : or(isNull(rows.pending_id), samePending, delta.seedId ? gt(rows.seed_id, delta.seedId) : isNotNull(rows.seed_id));
  return tx
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
      target: [rows.owner_id, rows.kind, rows.device_id, rows.record_id],
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
};
export const applyPersonalIndexRows = async (
  tx: PersonalIndexTransaction,
  owner: StorageOwner,
  changes: Change[],
  sourceId?: string,
) => {
  const changed: (typeof rows.$inferSelect)[] = [];
  for (const page of personalIndexPages(changes)) {
    if (page.length === 1) {
      changed.push(...(await updatePersonalIndexRow(tx, owner, page[0]!, sourceId)));
      continue;
    }
    const inserted = await tx
      .insert(rows)
      .values(
        page.map(({ delta, pendingId }) => ({
          ...personalIndexAddress(owner),
          device_id: delta.deviceId,
          kind: delta.kind,
          record_id: delta.id,
          value: delta.value,
          seed_id: delta.seedId ?? null,
          pending_id: pendingId ?? null,
        })),
      )
      .onConflictDoNothing()
      .returning();
    changed.push(...inserted);
    const created = new Set(
      inserted.map((row) =>
        personalIndexKey({ kind: row.kind, deviceId: row.device_id, id: row.record_id, value: row.value }),
      ),
    );
    for (const { delta, pendingId, settledId } of page) {
      if (created.has(personalIndexKey(delta))) continue;
      changed.push(...(await updatePersonalIndexRow(tx, owner, { delta, pendingId, settledId }, sourceId)));
    }
  }
  return changed;
};
