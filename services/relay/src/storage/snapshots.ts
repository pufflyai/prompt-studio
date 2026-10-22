import { and, asc, eq, gt, lte } from "drizzle-orm";
import { type Checkpoint, replayBoundary, replaySchema, snapshotSchema } from "pstdio-sync-contracts";
import { checkpoint, conflictFromRow, receiptFromRow } from "./codec";
import type { RelayTransaction } from "./database";
import { relayConflicts, relayOperations, relayRecords, relayScopes } from "./schema";

export const requireOwner = async (transaction: RelayTransaction, ownerId: string) => {
  const owner = (await transaction.select().from(relayScopes).where(eq(relayScopes.id, ownerId)))[0];
  if (!owner) throw new Error("Relay scope has not been initialized");
  return owner;
};

export const readSnapshot = async (transaction: RelayTransaction, ownerId: string) => {
  const owner = await requireOwner(transaction, ownerId);
  const records = await transaction.select().from(relayRecords).where(eq(relayRecords.ownerId, ownerId));
  const operations = await transaction
    .select()
    .from(relayOperations)
    .where(eq(relayOperations.ownerId, ownerId))
    .orderBy(asc(relayOperations.order));
  const conflicts = await transaction.select().from(relayConflicts).where(eq(relayConflicts.ownerId, ownerId));
  return snapshotSchema.parse({
    protocolVersion: 1,
    scope: owner.scope,
    journalSequence: owner.journalSequence,
    checkpoint: checkpoint(owner),
    records: Object.fromEntries(records.map((row) => [row.id, row.record])),
    receipts: Object.fromEntries(operations.map((row) => [row.id, receiptFromRow(row)])),
    conflicts: Object.fromEntries(conflicts.map((row) => [row.id, conflictFromRow(row)])),
    publishedRevision: owner.publishedRevision,
  });
};

export const readReplay = async (transaction: RelayTransaction, ownerId: string, after: Checkpoint) => {
  const owner = await requireOwner(transaction, ownerId);
  const through = checkpoint(owner);
  const boundary = replayBoundary(after, through, owner.replayFrom);
  if (boundary.status === "snapshot-required") return boundary;
  const operations = await transaction
    .select()
    .from(relayOperations)
    .where(
      and(
        eq(relayOperations.ownerId, ownerId),
        eq(relayOperations.checkpointEpoch, through.epoch),
        gt(relayOperations.acceptedSequence, after.sequence),
        lte(relayOperations.acceptedSequence, through.sequence),
      ),
    )
    .orderBy(asc(relayOperations.acceptedSequence));
  if (operations.length !== through.sequence - after.sequence)
    return { status: "snapshot-required" as const, checkpoint: through };
  return {
    status: "replay" as const,
    batch: replaySchema.parse({
      protocolVersion: 1,
      scope: owner.scope,
      after,
      through,
      groups: operations.map(receiptFromRow),
    }),
  };
};
