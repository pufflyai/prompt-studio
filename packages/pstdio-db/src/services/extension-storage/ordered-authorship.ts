import { and, eq, sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import type { OrderedAdmission, OrderedOperation } from "pstdio-sync/records";
import type { OperationReceipt } from "../../db/schemas/storage-ordered-records";
import { storage_ordered_operations as operations } from "../../db/schemas.pg";
import { operationReceipt } from "./ordered-receipt-values";
import { decodeOrderedJson as decode, type OrderedTransaction, orderedOwnerWhere } from "./ordered-sql";
import type { RetainedOperation } from "./retained-operations";

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
  retained: (id: string) => Promise<RetainedOperation | undefined>,
) => {
  const where = (id: string) => and(orderedOwnerWhere(operations, owner), eq(operations.operation_id, id));
  const receipt = async (id: string, epoch: string) => {
    const [row] = await tx
      .select({ receipt: sql<OperationReceipt | null>`${operations.receipt}->${epoch}::text` })
      .from(operations)
      .where(where(id));
    if (row) return row.receipt ?? undefined;
    const saved = await retained(id);
    return saved ? operationReceipt(saved.receipt, epoch) : undefined;
  };
  return {
    async operationCoordinates(id: string) {
      const [row] = await tx
        .select({ admission: operations.admission_epoch, settled: operations.settled_epoch })
        .from(operations)
        .where(where(id));
      if (row) return row;
      const saved = await retained(id);
      return saved && { admission: saved.admission_epoch, settled: saved.settled_epoch };
    },
    async localOperation(id: string) {
      const row = await operation(id);
      return row ? orderedLocalOperation(row) : undefined;
    },

    async isIndexed(id: string, epoch: string) {
      return (await receipt(id, epoch))?.indexed ?? false;
    },
    async publishedReceipt(id: string, epoch: string) {
      const saved = await receipt(id, epoch);
      if (!saved?.indexed || !saved.indexedAt) return;
      if (!Number.isFinite(Date.parse(saved.indexedAt))) throw new Error("Invalid receipt coverage time");
      return saved;
    },
    async requestIdentity(id: string) {
      const [row] = await tx.select({ request: operations.request_fingerprint }).from(operations).where(where(id));
      if (row) return row.request ?? undefined;
      return (await retained(id))?.request_fingerprint ?? undefined;
    },
  };
};

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
