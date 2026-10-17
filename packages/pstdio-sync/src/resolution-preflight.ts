import type { Snapshot } from "pstdio-sync-contracts";
import type { Projection } from "./projection";
import { blankRecord } from "./records";
import type { GroupedState, LocalOperation } from "./types";

export const resolutionGuards = (state: GroupedState, current: Iterable<Snapshot["conflicts"][string]>) => {
  const conflicts = new Map(
    Object.values(state.accepted?.conflicts ?? {}).map((conflict) => [conflict.conflictId, conflict]),
  );
  for (const conflict of current) conflicts.set(conflict.conflictId, conflict);
  return conflicts;
};

const parentProblem = (view: Projection, operation: LocalOperation, captured: Set<string>, visited: Set<string>) => {
  for (const parent of operation.parents) {
    if (captured.has(parent)) {
      if (!visited.has(parent)) return "Captured branch is not in ancestry order";
    } else {
      const outcome = view.outcomes.get(parent);
      if (!outcome || outcome.status === "conflict") return "Uncaptured unresolved prerequisite";
    }
  }
};

const connectedSize = (operations: LocalOperation[], rootId: string) => {
  const captured = new Set(operations.map((operation) => operation.operationId));
  const edges = new Map<string, Set<string>>();
  for (const operation of operations) {
    for (const parent of operation.parents.filter((id) => captured.has(id))) {
      edges.set(operation.operationId, new Set([...(edges.get(operation.operationId) ?? []), parent]));
      edges.set(parent, new Set([...(edges.get(parent) ?? []), operation.operationId]));
    }
  }
  const connected = new Set([rootId]);
  for (const id of connected) for (const next of edges.get(id) ?? []) connected.add(next);
  return connected.size;
};

const captureProblem = (view: Projection, state: GroupedState, mutation: LocalOperation) => {
  const proposal = mutation.resolution!;
  const captured = new Set(proposal.capturedOperationIds);
  if (!captured.has(proposal.conflictId)) return "Resolution must capture its root conflict";
  const available = new Map(state.journal.map((entry) => [entry.mutation.operationId, entry.mutation]));
  const visited = new Set<string>();
  const recordIds = new Set<string>();
  const operations: LocalOperation[] = [];
  for (const id of proposal.capturedOperationIds) {
    const operation = available.get(id);
    if (!operation || state.accepted?.receipts[id]?.status === "accepted") return "Captured branch is unavailable";
    const problem = parentProblem(view, operation, captured, visited);
    if (problem) return problem;
    operations.push(operation);
    visited.add(id);
    for (const change of operation.changes) recordIds.add(change.recordId);
  }
  if (connectedSize(operations, proposal.conflictId) !== captured.size) return "Unrelated captured operation";
  if (recordIds.size !== mutation.changes.length || mutation.changes.some((change) => !recordIds.has(change.recordId)))
    return "Resolution omits captured records";
};

export const resolutionProblem = (view: Projection, state: GroupedState, mutation: LocalOperation) => {
  const proposal = mutation.resolution!;
  const root = view.conflicts.get(proposal.conflictId);
  if (!root) return "Stale conflict revision";
  const conflicts = resolutionGuards(state, view.conflicts.values());
  for (const expected of proposal.expectedConflicts)
    if (conflicts.get(expected.conflictId)?.revision !== expected.revision) return "Stale conflict revision";
  const captured = new Set(proposal.capturedOperationIds);
  const affected = [...conflicts.values()].filter((conflict) =>
    conflict.alternativeOperationIds.some((id) => captured.has(id)),
  );
  if (
    affected.length !== proposal.expectedConflicts.length ||
    affected.some((conflict) => !proposal.expectedConflicts.some((entry) => entry.conflictId === conflict.conflictId))
  )
    return "Missing captured conflict revision";
  if (proposal.handler && proposal.handler.publishedRevision !== state.accepted?.publishedRevision)
    return "Stale published handler revision";
  for (const expected of proposal.expectedInputs)
    if (expected.revision !== (view.records.get(expected.recordId)?.revision ?? 0)) return "Stale input revision";
  for (const change of mutation.changes) {
    const record = view.records.get(change.recordId) ?? blankRecord(change.recordId);
    if (change.shared && record.primitive && change.shared.kind !== record.primitive)
      return "Incompatible shared primitive";
  }
  return captureProblem(view, state, mutation);
};

export const retainAfterResolution = (view: Projection, mutation: LocalOperation) => {
  const proposal = mutation.resolution!;
  const captured = new Set(proposal.capturedOperationIds);
  for (const id of captured) view.completed.add(id);
  for (const expected of proposal.expectedConflicts) {
    const conflict = view.conflicts.get(expected.conflictId);
    // Resolved ancestors guard captured history without becoming active conflicts again.
    if (!conflict) continue;
    view.conflicts.delete(expected.conflictId);
    for (const alternative of conflict.alternatives) {
      if (captured.has(alternative.operationId)) continue;
      view.conflicts.set(alternative.operationId, {
        conflictId: alternative.operationId,
        revision: 1,
        recordIds: alternative.records.map((record) => record.recordId),
        alternativeOperationIds: [alternative.operationId],
        reason: conflict.reason,
        alternatives: [alternative],
      });
    }
  }
};
