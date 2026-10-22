import type { Snapshot } from "../state";
import type { Mutation } from "../wire";
import { own } from "./dictionary";

function captureProblem(snapshot: Snapshot, mutation: Mutation, parentAccepted: (id: string) => boolean) {
  const proposal = mutation.resolution!;
  const captured = new Set(proposal.capturedOperationIds);
  if (!captured.has(proposal.conflictId)) return "resolution must capture its root conflict";
  const records = new Set<string>();
  const visited = new Set<string>();
  const edges = new Map<string, string[]>();
  for (const id of proposal.capturedOperationIds) {
    const receipt = own(snapshot.receipts, id);
    if (!receipt || receipt.status === "accepted") return "captured branch is unavailable";
    const parents = receipt.mutation.parents;
    if (parents.some((parent) => captured.has(parent) && !visited.has(parent)))
      return "captured branch is not in ancestry order";
    if (parents.some((parent) => !captured.has(parent) && !parentAccepted(parent)))
      return "uncaptured unaccepted prerequisite";
    for (const parent of parents.filter((parent) => captured.has(parent))) {
      edges.set(id, [...(edges.get(id) ?? []), parent]);
      edges.set(parent, [...(edges.get(parent) ?? []), id]);
    }
    visited.add(id);
    for (const change of receipt.mutation.changes) records.add(change.recordId);
  }
  if (connectedSize(edges, proposal.conflictId) !== captured.size) return "unrelated captured operation";
  if (records.size !== mutation.changes.length || mutation.changes.some((change) => !records.has(change.recordId)))
    return "resolution omits captured records";
}

export function resolutionProblem(
  snapshot: Snapshot,
  mutation: Mutation,
  parentAccepted = (id: string) => own(snapshot.receipts, id)?.status === "accepted",
) {
  const proposal = mutation.resolution;
  if (!proposal) return;
  const root = own(snapshot.conflicts, proposal.conflictId);
  if (!root || root.resolvedBy) return "stale conflict revision";
  for (const expected of proposal.expectedConflicts) {
    if (own(snapshot.conflicts, expected.conflictId)?.revision !== expected.revision) return "stale conflict revision";
  }
  const captured = new Set(proposal.capturedOperationIds);
  const affected = Object.values(snapshot.conflicts).filter((conflict) =>
    conflict.alternativeOperationIds.some((id) => captured.has(id)),
  );
  if (
    affected.length !== proposal.expectedConflicts.length ||
    affected.some((conflict) => !proposal.expectedConflicts.some((input) => input.conflictId === conflict.conflictId))
  )
    return "missing captured conflict revision";
  if (proposal.handler && proposal.handler.publishedRevision !== snapshot.publishedRevision)
    return "stale published handler revision";
  if (
    proposal.expectedInputs.some((input) => input.revision !== (own(snapshot.records, input.recordId)?.revision ?? 0))
  )
    return "stale input revision";
  return captureProblem(snapshot, mutation, parentAccepted);
}

function connectedSize(edges: Map<string, string[]>, root: string) {
  const connected = new Set([root]);
  for (const id of connected) for (const next of edges.get(id) ?? []) connected.add(next);
  return connected.size;
}
