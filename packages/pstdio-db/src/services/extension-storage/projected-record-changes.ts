import type { StorageOwner } from "pstdio-sync";
import { storage_current_records as current } from "../../db/schemas.pg";
import { type OrderedTransaction, orderedOwnerWhere } from "./ordered-sql";

/** Small checkpoints retain exact invalidation scope without loading record values or an unbounded index. */
export const captureProjectedRecordChanges = async (tx: OrderedTransaction, owner: StorageOwner) => {
  const rows = await tx
    .select({ id: current.record_id, revision: current.revision })
    .from(current)
    .where(orderedOwnerWhere(current, owner))
    .limit(129);
  const before = new Map(rows.map((row) => [row.id, row.revision]));
  return (records: readonly { recordId: string; revision: string }[]) => {
    if (rows.length > 128 || records.length > 128) return undefined;
    const after = new Map(records.map((record) => [record.recordId, record.revision]));
    return [...new Set([...before.keys(), ...after.keys()])].filter((id) => before.get(id) !== after.get(id));
  };
};
