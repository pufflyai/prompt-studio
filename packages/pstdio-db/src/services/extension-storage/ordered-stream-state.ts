import { sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import type { RecordStreamCursor } from "pstdio-sync/relay";
import { owners } from "../../db/schemas.pg";
import { receiptRoots } from "./ordered-receipts-state";
import { type OrderedTransaction, orderedOwnerWhere } from "./ordered-sql";

export const readOrderedOwner = async (tx: Pick<OrderedTransaction, "select">, owner: StorageOwner) => {
  const [row] = await tx.select().from(owners).where(orderedOwnerWhere(owners, owner));
  if (!row) throw new Error("Ordered owner has not been initialized");
  return row;
};
export const orderedCursor = (row: typeof owners.$inferSelect): RecordStreamCursor => ({
  receiptRoot: receiptRoots(row.receipt_root).published,
  receiptStateId: receiptRoots(row.receipt_root).stateId,
  joined: row.joined && hasOrderedCloudEpoch(row.epoch),
  after: row.after,
  stateId: row.state_id,
  through: row.through,
  pendingBytes: row.pending_bytes,
  stateBytes: row.state_bytes,
  skipped: row.skipped,
});
export const saveOrderedCursor = (
  tx: OrderedTransaction,
  owner: StorageOwner,
  cursor: RecordStreamCursor,
  epoch?: string,
) =>
  tx
    .update(owners)
    .set({
      // Before ordered admission, joined remembers released Cloud membership. A
      // transport cursor is admitted only once it has a remote epoch.
      joined: sql`CASE WHEN ${epoch ?? owners.epoch}::text IS NULL OR ${epoch ?? owners.epoch}::text = ''
        OR ${epoch ?? owners.epoch}::text LIKE 'local:%' THEN ${owners.joined} OR ${cursor.joined}
        ELSE ${cursor.joined} END`,
      after: cursor.after,
      state_id: cursor.stateId,
      through: cursor.through,
      pending_bytes: cursor.pendingBytes,
      state_bytes: cursor.stateBytes,
      skipped: cursor.skipped,
      ...(epoch === undefined ? {} : { epoch }),
    })
    .where(orderedOwnerWhere(owners, owner));

const hasOrderedCloudEpoch = (epoch: string | null) => !!epoch && !epoch.startsWith("local:");

/** A lost relay cursor does not undo a device's earlier Cloud admission. */
export const orderedOwnerJoinedCloud = (row: Pick<typeof owners.$inferSelect, "joined" | "epoch">) =>
  row.joined || hasOrderedCloudEpoch(row.epoch);
