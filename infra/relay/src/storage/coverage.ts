import { eq } from "drizzle-orm";
import { canonicalJson, coverageAckSchema, snapshotFingerprint } from "pstdio-sync-contracts";
import type { RelayTransaction } from "./database";
import { relayAcknowledgements, type relayScopes } from "./schema";
import { readSnapshot } from "./snapshots";

export const acknowledgeSnapshot = async (
  transaction: RelayTransaction,
  owner: typeof relayScopes.$inferSelect,
  input: unknown,
  environmentId: string,
) => {
  const ack = coverageAckSchema.parse(input);
  const snapshot = await readSnapshot(transaction, owner.id);
  if (
    canonicalJson(ack.scope) !== canonicalJson(owner.scope) ||
    ack.environmentId !== environmentId ||
    !Object.hasOwn(owner.writers, environmentId) ||
    ack.epoch !== owner.epoch ||
    ack.generation !== owner.generation ||
    ack.cut > snapshot.checkpoint.sequence
  )
    throw new Error("Coverage requires the exact installed snapshot and enrolled writer");
  if (ack.cut !== snapshot.checkpoint.sequence || ack.snapshotHash !== (await snapshotFingerprint(snapshot)))
    return { status: "snapshot-required" as const };
  for (const id of [...ack.branches, ...ack.recovery.flatMap((recovery) => recovery.branches)])
    if (!Object.hasOwn(snapshot.receipts, id)) throw new Error("Coverage branch is unavailable");
  for (const recovery of ack.recovery)
    if (recovery.generation !== snapshot.documents[recovery.recordId] || recovery.baseCut > ack.cut)
      throw new Error("Coverage recovery generation or cut is invalid");
  const [previous] = await transaction
    .select()
    .from(relayAcknowledgements)
    .where(eq(relayAcknowledgements.id, `${owner.id}:${environmentId}`));
  if (previous?.ack.epoch === ack.epoch && previous.ack.generation === ack.generation && previous.ack.cut > ack.cut)
    throw new Error("Coverage cannot regress");
  await transaction
    .insert(relayAcknowledgements)
    .values({ id: `${owner.id}:${environmentId}`, ownerId: owner.id, ack })
    .onConflictDoUpdate({ target: relayAcknowledgements.id, set: { ack } });
  return { status: "acknowledged" as const, acknowledgement: ack };
};
