import { and, eq, sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import type { StorageSaveOutcome } from "pstdio-sync-contracts";
import type { DbClient } from "../../db/connection.pglite";
import type { OperationReceipt } from "../../db/schemas/storage-ordered-records";
import { operations } from "../../db/schemas.pg";
import type { OrderedTransaction } from "./ordered-sql";
import { orderedOwnerWhere } from "./ordered-sql";
import { readRetainedOperation } from "./retained-operations";

/** Identity, settlement and its exact receipt share one row. Read that decision
 * atomically without hydrating the authored envelope or acquiring a write lock. */
export const readOrderedSaveOutcome = async (db: DbClient | OrderedTransaction, owner: StorageOwner, id: string) => {
  const [row] = await db
    .select({
      request: operations.request_fingerprint,
      epoch: operations.settled_epoch,
      receipt: sql<OperationReceipt | null>`${operations.receipt}->${operations.settled_epoch}`,
    })
    .from(operations)
    .where(and(orderedOwnerWhere(operations, owner), eq(operations.operation_id, id)));
  if (!row) {
    const saved =
      "rollback" in db
        ? await readRetainedOperation(db, owner, id)
        : await db.transaction((tx) => readRetainedOperation(tx, owner, id));
    if (saved)
      return outcomeFromReceipt(
        id,
        saved.request_fingerprint,
        saved.settled_epoch,
        saved.settled_epoch ? saved.receipt[saved.settled_epoch] : null,
      );
  }
  return row ? outcomeFromReceipt(id, row.request, row.epoch, row.receipt) : undefined;
};

const outcomeFromReceipt = (
  id: string,
  request: string | null,
  epoch: string | null,
  receipt: OperationReceipt | null | undefined,
) => {
  if (!request) return;
  let state: StorageSaveOutcome["state"] = "saved-locally";
  if (receipt?.state === "refused") state = "refused";
  else if (receipt && epoch && (!epoch.startsWith("local:") || receipt.indexed)) state = "synced";
  return { operationId: id, state, status: "saved-locally" } satisfies StorageSaveOutcome;
};
