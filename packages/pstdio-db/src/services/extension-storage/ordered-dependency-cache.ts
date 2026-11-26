import { and, eq, sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import type { OrderedDecision } from "pstdio-sync/records";
import { storage_ordered_operations as operations, owners } from "../../db/schemas.pg";
import type { OrderedTransaction } from "./ordered-sql";
import type { RetainedOperation } from "./retained-operations";
import { storageOwnerWhere } from "./storage-owner-key";

type Coordinates = Pick<typeof operations.$inferSelect, "admission_epoch" | "settled_epoch" | "receipt_epoch"> & {
  pending: boolean;
};

/** Foreign receipts need a selected epoch without claiming ownership of another host's command. */
export const createOrderedDependencyCache = (
  tx: OrderedTransaction,
  owner: StorageOwner,
  exact: (id: string, epoch: string) => Promise<OrderedDecision | undefined>,
  retained: (id: string) => Promise<RetainedOperation | undefined>,
) => {
  // One owner transaction replays the same pending dependencies on every rebase. Decisions arrive
  // through `remember` or `forget`, and an entry belongs to the order epoch it was read in.
  const memo = new Map<string, { epoch: string | null; decision: OrderedDecision | undefined }>();
  const lookup = async (row: Coordinates | undefined, id: string, epoch: string | null) => {
    if (row?.settled_epoch) return exact(id, row.settled_epoch);
    if (epoch) {
      const current = await exact(id, epoch);
      if (current) return current;
    }
    if (row?.admission_epoch) {
      const admitted = await exact(id, row.admission_epoch);
      if (admitted) return admitted;
    }
    if (row?.receipt_epoch) return exact(id, row.receipt_epoch);
  };
  return {
    async remember(decision: OrderedDecision) {
      memo.delete(decision.operationId);
    },
    forget(id: string) {
      memo.delete(id);
    },
    async known(id: string) {
      const [current] = await tx
        .select({
          epoch: owners.epoch,
          id: operations.operation_id,
          pending: sql<boolean>`${operations.envelope} IS NOT NULL`,
          admission_epoch: operations.admission_epoch,
          settled_epoch: operations.settled_epoch,
          receipt_epoch: operations.receipt_epoch,
        })
        .from(owners)
        .leftJoin(operations, and(eq(operations.owner_id, owners.id), eq(operations.operation_id, id)))
        .where(storageOwnerWhere(owner));
      // Keep the owner's current epoch and operation coordinates in one snapshot,
      // without copying an authored envelope just to test whether it is present.
      let row: Coordinates | undefined;
      if (current && current.id !== null) row = current;
      else {
        const saved = await retained(id);
        if (saved) row = { ...saved, pending: false };
      }
      // This device's own save that never entered an order has no decision anywhere yet.
      if (row?.pending && !row.admission_epoch && !row.settled_epoch) return undefined;
      const epoch = current?.epoch ?? null;
      const cached = memo.get(id);
      if (cached && cached.epoch === epoch) return cached.decision;
      const decision = await lookup(row, id, epoch);
      memo.set(id, { epoch, decision });
      return decision;
    },
  };
};
