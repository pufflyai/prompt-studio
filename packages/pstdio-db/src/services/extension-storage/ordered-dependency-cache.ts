import { and, eq } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import type { OrderedDecision } from "pstdio-sync/records";
import { storage_ordered_operations as operations, storage_ordered_owners as owners } from "../../db/schemas.pg";
import { readOrderedMarker, saveOrderedMarker } from "./ordered-native-metadata";
import { type OrderedTransaction, orderedOwnerWhere } from "./ordered-sql";

const marker = (id: string) => JSON.stringify(["ordered-dependency", id]);

/** Foreign receipts need a selected epoch without claiming ownership of another host's command. */
export const createOrderedDependencyCache = (
  tx: OrderedTransaction,
  owner: StorageOwner,
  exact: (id: string, epoch: string) => Promise<OrderedDecision | undefined>,
) => ({
  remember: (decision: OrderedDecision) =>
    saveOrderedMarker(tx, owner, marker(decision.operationId), { epoch: decision.epoch }),
  async known(id: string) {
    const [row] = await tx
      .select()
      .from(operations)
      .where(and(orderedOwnerWhere(operations, owner), eq(operations.operation_id, id)));
    if (row?.settled_epoch) return exact(id, row.settled_epoch);
    const [parent] = await tx.select({ epoch: owners.epoch }).from(owners).where(orderedOwnerWhere(owners, owner));
    if (parent?.epoch) {
      const current = await exact(id, parent.epoch);
      if (current) return current;
    }
    if (row?.admission_epoch) {
      const admitted = await exact(id, row.admission_epoch);
      if (admitted) return admitted;
    }
    const remembered = await readOrderedMarker<{ epoch: string }>(tx, owner, marker(id));
    return remembered ? exact(id, remembered.value.epoch) : undefined;
  },
});
