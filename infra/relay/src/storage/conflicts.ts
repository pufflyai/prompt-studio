import { and, arrayOverlaps, eq, isNull, or, sql } from "drizzle-orm";
import type { ResolutionState } from "pstdio-sync";
import type { Mutation } from "pstdio-sync-contracts";
import type { RelayTransaction } from "./database";
import { relayConflicts, relayOperations } from "./schema";

const completedAlternatives = async (transaction: RelayTransaction, ownerId: string, ids: string[]) => {
  const completed = new Set<string>();
  if (!ids.length) return completed;
  const resolutions = await transaction
    .select({ mutation: relayOperations.mutation })
    .from(relayOperations)
    .where(
      and(
        eq(relayOperations.ownerId, ownerId),
        eq(relayOperations.status, "accepted"),
        sql`${relayOperations.mutation}->'resolution'->'capturedOperationIds' ?| ARRAY[${sql.join(
          ids.map((id) => sql`${id}`),
          sql`, `,
        )}]::text[]`,
      ),
    );
  for (const resolution of resolutions)
    for (const id of resolution.mutation.resolution!.capturedOperationIds) completed.add(id);
  return completed;
};

export const advanceConflicts = async (transaction: RelayTransaction, ownerId: string, mutation: Mutation) => {
  await transaction
    .update(relayConflicts)
    .set({ revision: sql`${relayConflicts.revision} + 1` })
    .where(
      and(
        eq(relayConflicts.ownerId, ownerId),
        isNull(relayConflicts.resolvedBy),
        or(
          arrayOverlaps(
            relayConflicts.recordIds,
            mutation.changes.map((change) => change.recordId),
          ),
          mutation.resolution ? eq(relayConflicts.id, mutation.resolution.conflictId) : undefined,
        ),
      ),
    );
};

export const retainConflict = async (
  transaction: RelayTransaction,
  ownerId: string,
  state: ResolutionState,
  mutation: Mutation,
) => {
  const root = mutation.resolution && state.conflicts.get(mutation.resolution.conflictId);
  if (root && !root.resolvedBy) {
    await transaction
      .update(relayConflicts)
      .set({ alternativeOperationIds: [...root.alternativeOperationIds, mutation.operationId] })
      .where(and(eq(relayConflicts.ownerId, ownerId), eq(relayConflicts.id, root.conflictId)));
    return root.conflictId;
  }
  await transaction.insert(relayConflicts).values({
    ownerId,
    id: mutation.operationId,
    revision: 1,
    recordIds: mutation.changes.map((change) => change.recordId),
    alternativeOperationIds: [mutation.operationId],
  });
  return mutation.operationId;
};

export const acceptResolution = async (
  transaction: RelayTransaction,
  ownerId: string,
  state: ResolutionState,
  mutation: Mutation,
) => {
  const proposal = mutation.resolution;
  if (!proposal) return;
  const captured = new Set(proposal.capturedOperationIds);
  const alternatives = proposal.expectedConflicts.flatMap((expected) =>
    state.conflicts.get(expected.conflictId)!.alternativeOperationIds.filter((id) => !captured.has(id)),
  );
  const completed = await completedAlternatives(transaction, ownerId, alternatives);
  for (const expected of proposal.expectedConflicts) {
    const conflict = state.conflicts.get(expected.conflictId)!;
    for (const id of conflict.alternativeOperationIds) {
      if (captured.has(id) || completed.has(id) || state.acceptedOperationIds.has(id)) continue;
      const operation = state.operations.get(id)!;
      await transaction
        .insert(relayConflicts)
        .values({
          ownerId,
          id,
          revision: 1,
          recordIds: operation.changes.map((change) => change.recordId),
          alternativeOperationIds: [id],
        })
        .onConflictDoNothing();
    }
    await transaction
      .update(relayConflicts)
      .set({ resolvedBy: mutation.operationId })
      .where(and(eq(relayConflicts.ownerId, ownerId), eq(relayConflicts.id, expected.conflictId)));
  }
};
