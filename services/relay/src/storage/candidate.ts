import { and, arrayOverlaps, eq, inArray, isNull, or } from "drizzle-orm";
import {
  applyRecordChange,
  blankRecord,
  type ResolutionState,
  recordConflict,
  validateResolution,
} from "pstdio-sync/records";
import type { Mutation } from "pstdio-sync-contracts";
import { conflictFromRow } from "./codec";
import type { RelayTransaction } from "./database";
import { relayConflicts, relayOperations, relayRecords, type relayScopes } from "./schema";

export const loadCandidate = async (
  transaction: RelayTransaction,
  owner: typeof relayScopes.$inferSelect,
  mutation: Mutation,
) => {
  const ids = mutation.changes.map((change) => change.recordId);
  const rows = await transaction
    .select()
    .from(relayRecords)
    .where(and(eq(relayRecords.ownerId, owner.id), inArray(relayRecords.id, ids)));
  const captured = mutation.resolution?.capturedOperationIds ?? [];
  const expected = mutation.resolution?.expectedConflicts.map((entry) => entry.conflictId) ?? [];
  const conflicts = mutation.resolution
    ? await transaction
        .select()
        .from(relayConflicts)
        .where(
          and(
            eq(relayConflicts.ownerId, owner.id),
            or(
              and(isNull(relayConflicts.resolvedBy), arrayOverlaps(relayConflicts.recordIds, ids)),
              expected.length ? inArray(relayConflicts.id, expected) : undefined,
              captured.length ? arrayOverlaps(relayConflicts.alternativeOperationIds, captured) : undefined,
            ),
          ),
        )
    : [];
  const needed = new Set(
    mutation.resolution
      ? [...mutation.parents, ...captured, ...conflicts.flatMap((conflict) => conflict.alternativeOperationIds)]
      : [],
  );
  const operations = needed.size
    ? await transaction
        .select()
        .from(relayOperations)
        .where(and(eq(relayOperations.ownerId, owner.id), inArray(relayOperations.id, [...needed])))
    : [];
  const prerequisites = [
    ...new Set(operations.filter((row) => captured.includes(row.id)).flatMap((row) => row.mutation.parents)),
  ].filter((id) => !needed.has(id));
  if (prerequisites.length)
    operations.push(
      ...(await transaction
        .select()
        .from(relayOperations)
        .where(and(eq(relayOperations.ownerId, owner.id), inArray(relayOperations.id, prerequisites)))),
    );
  const accepted = new Set(operations.filter((row) => row.status === "accepted").map((row) => row.id));
  const state: ResolutionState = {
    records: new Map(rows.map((row) => [row.id, row.record])),
    conflicts: new Map(conflicts.map((row) => [row.id, conflictFromRow(row)])),
    operations: new Map(operations.map((row) => [row.id, row.mutation])),
    acceptedOperationIds: accepted,
    availableParentIds: accepted,
    publishedRevision: owner.publishedRevision,
  };
  return state;
};

export const stageCandidate = async (state: ResolutionState, mutation: Mutation) => {
  const problem = validateResolution(state, mutation);
  if (problem) return { status: "conflict" as const, reason: problem };
  const records = new Map(state.records);
  for (const change of mutation.changes) {
    const current = records.get(change.recordId) ?? blankRecord(change.recordId);
    if (!mutation.resolution) {
      const reason = await recordConflict(current, change);
      if (reason) return { status: "conflict" as const, reason };
    }
    records.set(change.recordId, applyRecordChange(current, change));
  }
  return { status: "accepted" as const, records };
};
