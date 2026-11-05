import type { StorageOwner } from "pstdio-sync";
import type { RecordStreamCursor } from "pstdio-sync/relay";
import { storage_record_sync as legacy, storage_ordered_owners as owners } from "../../db/schemas.pg";
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
  joined: row.joined,
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
      joined: cursor.joined,
      after: cursor.after,
      state_id: cursor.stateId,
      through: cursor.through,
      pending_bytes: cursor.pendingBytes,
      state_bytes: cursor.stateBytes,
      skipped: cursor.skipped,
      ...(epoch === undefined ? {} : { epoch }),
    })
    .where(orderedOwnerWhere(owners, owner));

/** Upgrading a joined legacy stream is not a device's first Cloud join. */
export const joinedLegacyOrderedOwner = async (tx: Pick<OrderedTransaction, "select">, owner: StorageOwner) => {
  const [row] = await tx.select({ joined: legacy.joined }).from(legacy).where(orderedOwnerWhere(legacy, owner));
  return row?.joined ?? false;
};

/** A lost relay cursor does not undo a device's earlier Cloud admission. */
export const orderedOwnerJoinedCloud = async (
  tx: Pick<OrderedTransaction, "select">,
  owner: StorageOwner,
  row: Pick<typeof owners.$inferSelect, "joined" | "epoch">,
) => row.joined || (!!row.epoch && !row.epoch.startsWith("local:")) || (await joinedLegacyOrderedOwner(tx, owner));
