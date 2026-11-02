import type { Mutation, Snapshot, StoredRecord } from "pstdio-sync-contracts";
import { blankRecord } from "./records";

type ResolutionOperation = Pick<Mutation, "operationId" | "parents" | "changes" | "resolution">;

export interface ResolutionState {
  records: ReadonlyMap<string, StoredRecord>;
  conflicts: ReadonlyMap<string, Snapshot["conflicts"][string]>;
  operations: ReadonlyMap<string, ResolutionOperation>;
  acceptedOperationIds: ReadonlySet<string>;
  availableParentIds: ReadonlySet<string>;
  publishedRevision: string | undefined;
}

const parentProblem = (
  state: ResolutionState,
  operation: ResolutionOperation,
  captured: Set<string>,
  visited: Set<string>,
) => {
  for (const parent of operation.parents) {
    if (captured.has(parent)) {
      if (!visited.has(parent)) return "captured branch is not in ancestry order";
    } else if (!state.availableParentIds.has(parent)) return "uncaptured unaccepted prerequisite";
  }
};

const connectedSize = (operations: ResolutionOperation[], rootId: string) => {
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

const captureProblem = (state: ResolutionState, mutation: ResolutionOperation) => {
  const proposal = mutation.resolution!;
  const captured = new Set(proposal.capturedOperationIds);
  if (!captured.has(proposal.conflictId)) return "resolution must capture its root conflict";
  const visited = new Set<string>();
  const recordIds = new Set<string>();
  const operations: ResolutionOperation[] = [];
  for (const id of proposal.capturedOperationIds) {
    const operation = state.operations.get(id);
    if (!operation || state.acceptedOperationIds.has(id)) return "captured branch is unavailable";
    const problem = parentProblem(state, operation, captured, visited);
    if (problem) return problem;
    operations.push(operation);
    visited.add(id);
    for (const change of operation.changes) recordIds.add(change.recordId);
  }
  if (connectedSize(operations, proposal.conflictId) !== captured.size) return "unrelated captured operation";
  if (recordIds.size !== mutation.changes.length || mutation.changes.some((change) => !recordIds.has(change.recordId)))
    return "resolution omits captured records";
};

export const validateResolution = (state: ResolutionState, mutation: ResolutionOperation) => {
  const proposal = mutation.resolution;
  if (!proposal) return;
  const root = state.conflicts.get(proposal.conflictId);
  if (!root || root.resolvedBy) return "stale conflict revision";
  for (const expected of proposal.expectedConflicts) {
    const conflict = state.conflicts.get(expected.conflictId);
    if (!conflict || conflict.revision !== expected.revision) return "stale conflict revision";
  }
  const captured = new Set(proposal.capturedOperationIds);
  const affected = [...state.conflicts.values()].filter((conflict) =>
    conflict.alternativeOperationIds.some((id) => captured.has(id)),
  );
  if (
    affected.length !== proposal.expectedConflicts.length ||
    affected.some((conflict) => !proposal.expectedConflicts.some((entry) => entry.conflictId === conflict.conflictId))
  )
    return "missing captured conflict revision";
  if (proposal.handler && proposal.handler.publishedRevision !== state.publishedRevision)
    return "stale published handler revision";
  for (const expected of proposal.expectedInputs)
    if (expected.revision !== (state.records.get(expected.recordId)?.revision ?? 0)) return "stale input revision";
  for (const change of mutation.changes) {
    const record = state.records.get(change.recordId) ?? blankRecord(change.recordId);
    if (change.shared && record.primitive && change.shared.kind !== record.primitive)
      return "incompatible shared primitive";
  }
  return captureProblem(state, mutation);
};
