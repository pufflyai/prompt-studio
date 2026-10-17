import { eq } from "drizzle-orm";
import type { Mutation, Receipt } from "pstdio-sync-contracts";
import { operationRow } from "./codec";
import type { RelayTransaction } from "./database";
import { relayOperations, relayScopes } from "./schema";

export const saveReceipt = async (
  transaction: RelayTransaction,
  owner: typeof relayScopes.$inferSelect,
  mutation: Mutation,
  previous: typeof relayOperations.$inferSelect | undefined,
  result: Pick<Receipt, "status" | "reason" | "conflictId">,
) => {
  const receipt: Receipt = {
    order: previous?.order ?? owner.journalSequence + 1,
    operationId: mutation.operationId,
    fingerprint: mutation.fingerprint,
    mutation,
    ...result,
    checkpoint: result.status === "accepted" ? { epoch: owner.epoch, sequence: owner.acceptedSequence + 1 } : null,
  };
  const row = operationRow(owner.id, receipt);
  const { mutation: _body, ownerId: _ownerId, id: _id, order: _order, ...outcome } = row;
  await transaction
    .insert(relayOperations)
    .values(row)
    .onConflictDoUpdate({
      target: [relayOperations.ownerId, relayOperations.id],
      set: outcome,
    });
  await transaction
    .update(relayScopes)
    .set({
      journalSequence: previous ? owner.journalSequence : receipt.order,
      acceptedSequence: receipt.checkpoint?.sequence ?? owner.acceptedSequence,
    })
    .where(eq(relayScopes.id, owner.id));
  return receipt;
};
