import { and, eq, inArray } from "drizzle-orm";
import {
  type Asset,
  type Mutation,
  publishedExtensionsId,
  type Scope,
  validatePublicationRecord,
} from "pstdio-sync-contracts";
import { loadCandidate, stageCandidate } from "./candidate";
import { receiptFromRow } from "./codec";
import { acceptResolution, advanceConflicts, retainConflict } from "./conflicts";
import type { RelayTransaction } from "./database";
import { saveReceipt } from "./receipts";
import { relayOperations, relayRecords, type relayScopes } from "./schema";

export interface RelayAssets {
  complete(scope: Scope, asset: Asset, signal?: AbortSignal): Promise<boolean>;
}

const dependencyProblem = async (
  transaction: RelayTransaction,
  ownerId: string,
  mutation: Mutation,
  assets: RelayAssets,
  signal?: AbortSignal,
) => {
  const parents = mutation.parents.length
    ? await transaction
        .select()
        .from(relayOperations)
        .where(and(eq(relayOperations.ownerId, ownerId), inArray(relayOperations.id, mutation.parents)))
    : [];
  const ready = new Set(parents.filter((parent) => parent.status === "accepted").map((parent) => parent.id));
  const captured = new Set(mutation.resolution?.capturedOperationIds ?? []);
  if (mutation.parents.some((id) => !captured.has(id) && !ready.has(id))) return "unaccepted dependency";
  for (const change of mutation.changes)
    if (change.asset?.next && !(await assets.complete(mutation.scope, change.asset.next, signal)))
      return "incomplete assets";
};

export const publishGroup = async (
  transaction: RelayTransaction,
  owner: typeof relayScopes.$inferSelect,
  mutation: Mutation,
  assets: RelayAssets,
  signal?: AbortSignal,
) => {
  const previous = (
    await transaction
      .select()
      .from(relayOperations)
      .where(and(eq(relayOperations.ownerId, owner.id), eq(relayOperations.id, mutation.operationId)))
  )[0];
  if (previous && previous.mutation.fingerprint !== mutation.fingerprint)
    throw new Error("Operation identity reused with changed content");
  if (previous && previous.status !== "pending") return receiptFromRow(previous);
  const waiting = await dependencyProblem(transaction, owner.id, mutation, assets, signal);
  if (waiting) return saveReceipt(transaction, owner, mutation, previous, { status: "pending", reason: waiting });

  const state = await loadCandidate(transaction, owner, mutation);
  const candidate = await stageCandidate(state, mutation);
  await advanceConflicts(transaction, owner.id, mutation);
  if (candidate.status === "conflict") {
    const conflictId = await retainConflict(transaction, owner.id, state, mutation);
    return saveReceipt(transaction, owner, mutation, previous, {
      status: "conflict",
      reason: candidate.reason,
      conflictId,
    });
  }
  if (owner.scope.extensionId === publishedExtensionsId)
    for (const record of candidate.records.values()) validatePublicationRecord(record);
  for (const record of candidate.records.values())
    await transaction
      .insert(relayRecords)
      .values({ ownerId: owner.id, id: record.recordId, record })
      .onConflictDoUpdate({ target: [relayRecords.ownerId, relayRecords.id], set: { record } });
  await acceptResolution(transaction, owner.id, state, mutation);
  return saveReceipt(transaction, owner, mutation, previous, { status: "accepted" });
};
