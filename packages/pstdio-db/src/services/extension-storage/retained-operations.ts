import type { StorageOwner } from "pstdio-sync";
import { type operations, owners } from "../../db/schemas.pg";
import { operationIndexedAt, operationReceipt } from "./ordered-receipt-values";
import type { OrderedTransaction } from "./ordered-sql";
import { createRetainedPages } from "./retained-pages";
import { storageOwnerWhere } from "./storage-owner-key";

/** Device-private authorship/epoch selectors are distinct from foreign relay receipts. */
export type RetainedOperation = typeof operations.$inferSelect & { envelope: null; admission: null };
export type RetainedOperationValue = Omit<RetainedOperation, "owner_id">;

export const readRetainedOperation = async (tx: OrderedTransaction, owner: StorageOwner, id: string) => {
  const row = await createRetainedPages<RetainedOperationValue>(tx, owner, "authorship").get(id);
  if (row === undefined) return;
  if (
    !row ||
    typeof row !== "object" ||
    Array.isArray(row) ||
    row.operation_id !== id ||
    row.envelope !== null ||
    row.admission !== null ||
    row.touches.length !== 0 ||
    !row.receipt_indexed ||
    !row.indexed_at ||
    operationIndexedAt(row.receipt) !== row.indexed_at ||
    !Object.keys(row.receipt).length
  )
    throw new Error("Invalid retained operation identity or coverage");
  if (row.request_fingerprint && (!row.settled_epoch || !operationReceipt(row.receipt, row.settled_epoch)))
    throw new Error("A retained authored operation requires its selected exact outcome");
  // The private document address owns identity. SQL owner keys can change during backup restore.
  const [address] = await tx.select({ id: owners.id }).from(owners).where(storageOwnerWhere(owner));
  if (!address) throw new Error("The retained operation owner is missing");
  return { ...row, owner_id: address.id };
};
