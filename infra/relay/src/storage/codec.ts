import type { Receipt, Snapshot } from "pstdio-sync-contracts";
import type { relayConflicts, relayOperations, relayScopes } from "./schema";

export const checkpoint = (owner: typeof relayScopes.$inferSelect) => ({
  epoch: owner.epoch,
  sequence: owner.acceptedSequence,
});

export const receiptFromRow = (row: typeof relayOperations.$inferSelect) =>
  ({
    order: row.order,
    operationId: row.id,
    fingerprint: row.mutation.fingerprint,
    mutation: row.mutation,
    status: row.status,
    checkpoint:
      row.checkpointEpoch !== null && row.acceptedSequence !== null
        ? { epoch: row.checkpointEpoch, sequence: row.acceptedSequence }
        : null,
    ...(row.conflictId === null ? {} : { conflictId: row.conflictId }),
    ...(row.reason === null ? {} : { reason: row.reason }),
  }) satisfies Receipt;

export const conflictFromRow = (row: typeof relayConflicts.$inferSelect) => ({
  conflictId: row.id,
  revision: row.revision,
  recordIds: row.recordIds,
  alternativeOperationIds: row.alternativeOperationIds,
  ...(row.resolvedBy === null ? {} : { resolvedBy: row.resolvedBy }),
});

export const operationRow = (ownerId: string, receipt: Receipt) => ({
  ownerId,
  id: receipt.operationId,
  mutation: receipt.mutation,
  order: receipt.order,
  status: receipt.status,
  checkpointEpoch: receipt.checkpoint?.epoch ?? null,
  acceptedSequence: receipt.checkpoint?.sequence ?? null,
  conflictId: receipt.conflictId ?? null,
  reason: receipt.reason ?? null,
});

export const conflictRow = (ownerId: string, conflict: Snapshot["conflicts"][string]) => ({
  ownerId,
  id: conflict.conflictId,
  revision: conflict.revision,
  recordIds: conflict.recordIds,
  alternativeOperationIds: conflict.alternativeOperationIds,
  resolvedBy: conflict.resolvedBy ?? null,
});
