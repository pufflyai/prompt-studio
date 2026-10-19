import { type MutationBody, sealMutation } from "pstdio-sync-contracts";
import { createRelayStorage } from "./storage";

type Position = "epoch" | "generation" | "sequence";
const positions = new Map<string, number>();

// Integration fixtures obtain real owner lineage instead of guessing epochs.
export const sealStoredMutation = async (
  body: Omit<MutationBody, Position> & Partial<Pick<MutationBody, Position>>,
  databaseUrl = process.env.SYNC_TEST_DATABASE_URL ?? process.env.DATABASE_URL!,
) => {
  if (body.epoch !== undefined && body.generation !== undefined && body.sequence !== undefined)
    return sealMutation({ ...body, epoch: body.epoch, generation: body.generation, sequence: body.sequence });
  const storage = createRelayStorage(databaseUrl, {
    complete: async () => true,
  });
  try {
    const snapshot = await storage.owner(body.scope).snapshot();
    const key = JSON.stringify([body.scope, snapshot.checkpoint.epoch, body.environmentId]);
    const previous = snapshot.receipts[body.operationId]?.mutation;
    const high = Math.max(
      snapshot.writers[body.environmentId]?.floor ?? 0,
      positions.get(key) ?? 0,
      ...Object.values(snapshot.receipts)
        .filter((receipt) => receipt.mutation.environmentId === body.environmentId)
        .map((receipt) => receipt.mutation.sequence),
    );
    const sequence = body.sequence ?? previous?.sequence ?? high + 1;
    positions.set(key, Math.max(sequence, high));
    return sealMutation({
      ...body,
      epoch: body.epoch ?? snapshot.checkpoint.epoch,
      generation: body.generation ?? snapshot.generation,
      sequence,
    });
  } finally {
    await storage.close();
  }
};
