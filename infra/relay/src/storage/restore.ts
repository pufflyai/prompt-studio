import { eq } from "drizzle-orm";
import type { Snapshot } from "pstdio-sync-contracts";
import { conflictRow, operationRow } from "./codec";
import type { RelayTransaction } from "./database";
import { relayConflicts, relayOperations, relayRecords, relayScopes } from "./schema";

export const restoreSnapshot = async (transaction: RelayTransaction, ownerId: string, saved: Snapshot) => {
  await transaction.delete(relayConflicts).where(eq(relayConflicts.ownerId, ownerId));
  await transaction.delete(relayOperations).where(eq(relayOperations.ownerId, ownerId));
  await transaction.delete(relayRecords).where(eq(relayRecords.ownerId, ownerId));
  for (const record of Object.values(saved.records))
    await transaction.insert(relayRecords).values({ ownerId, id: record.recordId, record });
  for (const receipt of Object.values(saved.receipts))
    await transaction.insert(relayOperations).values(operationRow(ownerId, receipt));
  for (const conflict of Object.values(saved.conflicts))
    await transaction.insert(relayConflicts).values(conflictRow(ownerId, conflict));
  // Restored receipts keep their original acknowledgments. Replay starts at the new lineage boundary.
  await transaction
    .update(relayScopes)
    .set({
      epoch: crypto.randomUUID(),
      acceptedSequence: saved.checkpoint.sequence,
      replayFrom: saved.checkpoint.sequence,
      journalSequence: saved.journalSequence,
      publishedRevision: saved.publishedRevision,
    })
    .where(eq(relayScopes.id, ownerId));
};
