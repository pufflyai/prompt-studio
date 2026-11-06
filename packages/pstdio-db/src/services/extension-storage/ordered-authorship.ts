import { and, eq } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import type { OrderedAdmission, OrderedOperation } from "pstdio-sync/records";
import { storage_ordered_operations as operations, storage_ordered_receipts as receipts } from "../../db/schemas.pg";
import { decodeOrderedJson as decode, type OrderedTransaction, orderedOwnerWhere } from "./ordered-sql";

export const orderedLocalOperation = (row: typeof operations.$inferSelect) =>
  row.envelope
    ? {
        sequence: row.local_sequence,
        operation: decode<OrderedOperation>(row.envelope),
        requestFingerprint: row.request_fingerprint,
        admission: row.admission ? decode<OrderedAdmission>(row.admission) : null,
        delivered: row.delivered,
      }
    : undefined;

/** Compact authored identities and exact local outcomes survive dropping settled payloads. */
export const createOrderedAuthorship = (
  tx: OrderedTransaction,
  owner: StorageOwner,
  operation: (id: string) => Promise<typeof operations.$inferSelect | undefined>,
) => ({
  async operationCoordinates(id: string) {
    const row = await operation(id);
    return row && { admission: row.admission_epoch, settled: row.settled_epoch };
  },
  async localOperation(id: string) {
    const row = await operation(id);
    return row ? orderedLocalOperation(row) : undefined;
  },

  async isIndexed(id: string, epoch: string) {
    const [row] = await tx
      .select({ indexed: receipts.indexed })
      .from(receipts)
      .where(and(orderedOwnerWhere(receipts, owner), eq(receipts.operation_id, id), eq(receipts.epoch, epoch)));
    return row?.indexed ?? false;
  },
  async requestIdentity(id: string) {
    return (await operation(id))?.request_fingerprint ?? undefined;
  },
  async dropSettledEnvelope(id: string) {
    const row = await operation(id);
    if (!row?.settled_epoch) throw new Error("Only a decided save can drop its envelope");
    await tx
      .update(operations)
      .set({ envelope: null, admission: null })
      .where(and(orderedOwnerWhere(operations, owner), eq(operations.operation_id, id)));
  },
});

export const retryOrderedLocalOperation = (
  row: typeof operations.$inferSelect,
  input: OrderedOperation,
  requestFingerprint: string,
) => {
  if (row.request_fingerprint !== requestFingerprint) throw new Error("Operation identity reused with changed payload");
  return (
    orderedLocalOperation(row) ?? {
      sequence: row.local_sequence,
      operation: input,
      requestFingerprint,
      admission: null,
      delivered: row.delivered,
    }
  );
};
