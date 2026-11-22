import { and, eq } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import type { OrderedDecision } from "pstdio-sync/records";
import { storage_ordered_operations as operations, owners } from "../../db/schemas.pg";
import { readOrderedMarker } from "./ordered-native-metadata";
import { type OrderedTransaction, orderedOwnerWhere } from "./ordered-sql";

const marker = (id: string) => JSON.stringify(["ordered-dependency", id]);

/** Foreign receipts need a selected epoch without claiming ownership of another host's command. */
export const createOrderedDependencyCache = (
  tx: OrderedTransaction,
  owner: StorageOwner,
  exact: (id: string, epoch: string) => Promise<OrderedDecision | undefined>,
  operation?: (id: string) => Promise<typeof operations.$inferSelect | undefined>,
) => {
  // One owner transaction replays the same pending dependencies on every rebase. Decisions arrive
  // through `remember` or `forget`, and an entry belongs to the order epoch it was read in.
  const memo = new Map<string, { epoch: string | null; decision: OrderedDecision | undefined }>();
  const lookup = async (row: typeof operations.$inferSelect | undefined, id: string, epoch: string | null) => {
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
    // Released homes retain the original selector until their document archive is restored.
    const remembered = await readOrderedMarker<{ epoch: string }>(tx, owner, marker(id));
    return remembered ? exact(id, remembered.value.epoch) : undefined;
  };
  return {
    async remember(decision: OrderedDecision) {
      memo.delete(decision.operationId);
    },
    forget(id: string) {
      memo.delete(id);
    },
    async known(id: string) {
      const row = operation
        ? await operation(id)
        : (
            await tx
              .select()
              .from(operations)
              .where(and(orderedOwnerWhere(operations, owner), eq(operations.operation_id, id)))
          )[0];
      // This device's own save that never entered an order has no decision anywhere yet.
      if (row?.envelope && !row.admission_epoch && !row.settled_epoch) return undefined;
      const [parent] = await tx.select({ epoch: owners.epoch }).from(owners).where(orderedOwnerWhere(owners, owner));
      const epoch = parent?.epoch ?? null;
      const cached = memo.get(id);
      if (cached && cached.epoch === epoch) return cached.decision;
      const decision = await lookup(row, id, epoch);
      memo.set(id, { epoch, decision });
      return decision;
    },
  };
};
