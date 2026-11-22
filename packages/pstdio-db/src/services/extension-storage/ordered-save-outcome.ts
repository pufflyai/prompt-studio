import { and, eq, sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import type { StorageSaveOutcome } from "pstdio-sync-contracts";
import type { DbClient } from "../../db/connection.pglite";
import type { OperationReceipt } from "../../db/schemas/storage-ordered-records";
import { operations } from "../../db/schemas.pg";
import { orderedOwnerWhere } from "./ordered-sql";

/** Identity, settlement and its exact receipt share one row. Read that decision
 * atomically without hydrating the authored envelope or acquiring a write lock. */
export const readOrderedSaveOutcome = async (db: Pick<DbClient, "select">, owner: StorageOwner, id: string) => {
  const [row] = await db
    .select({
      request: operations.request_fingerprint,
      epoch: operations.settled_epoch,
      receipt: sql<OperationReceipt | null>`${operations.receipt}->${operations.settled_epoch}`,
    })
    .from(operations)
    .where(and(orderedOwnerWhere(operations, owner), eq(operations.operation_id, id)));
  if (!row?.request) return;
  let state: StorageSaveOutcome["state"] = "saved-locally";
  if (row.receipt?.state === "refused") state = "refused";
  else if (row.receipt && row.epoch && (!row.epoch.startsWith("local:") || row.receipt.indexed)) state = "synced";
  return { operationId: id, state, status: "saved-locally" } satisfies StorageSaveOutcome;
};
