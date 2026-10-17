import type { Snapshot } from "pstdio-sync-contracts";
import type { Projection } from "./projection";
import { validateResolution } from "./resolution-validation";
import type { GroupedState, LocalOperation } from "./types";

export const resolutionGuards = (state: GroupedState, current: Iterable<Snapshot["conflicts"][string]>) => {
  const conflicts = new Map(
    Object.values(state.accepted?.conflicts ?? {}).map((conflict) => [conflict.conflictId, conflict]),
  );
  for (const conflict of current) conflicts.set(conflict.conflictId, conflict);
  return conflicts;
};

export const resolutionProblem = (view: Projection, state: GroupedState, mutation: LocalOperation) => {
  if (mutation.resolution && !view.conflicts.has(mutation.resolution.conflictId)) return "stale conflict revision";
  return validateResolution(
    {
      records: view.records,
      conflicts: resolutionGuards(state, view.conflicts.values()),
      operations: new Map(state.journal.map((entry) => [entry.mutation.operationId, entry.mutation])),
      acceptedOperationIds: new Set(
        Object.values(state.accepted?.receipts ?? {})
          .filter((receipt) => receipt.status === "accepted")
          .map((receipt) => receipt.operationId),
      ),
      availableParentIds: new Set(
        [...view.outcomes].filter(([, outcome]) => outcome.status !== "conflict").map(([id]) => id),
      ),
      publishedRevision: state.accepted?.publishedRevision,
    },
    mutation,
  );
};

export const retainAfterResolution = (view: Projection, mutation: LocalOperation) => {
  const proposal = mutation.resolution!;
  const captured = new Set(proposal.capturedOperationIds);
  for (const id of captured) view.completed.add(id);
  for (const expected of proposal.expectedConflicts) {
    const conflict = view.conflicts.get(expected.conflictId);
    // Resolved ancestors still guard the proposal; only open branches need projection cleanup.
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
