import type { Snapshot } from "../state";
import type { Mutation } from "../wire";
import { completedOperations } from "./completed-operations";
import { own, put } from "./dictionary";

export function retainUncapturedAlternatives(state: Snapshot, mutation: Mutation) {
  const completed = completedOperations(state);
  const captured = new Set(mutation.resolution?.capturedOperationIds ?? []);
  for (const expected of mutation.resolution?.expectedConflicts ?? []) {
    const conflict = own(state.conflicts, expected.conflictId)!;
    for (const id of conflict.alternativeOperationIds.filter((id) => !captured.has(id))) {
      const receipt = own(state.receipts, id)!;
      if (completed.has(id) || own(state.conflicts, id)) continue;
      put(state.conflicts, id, {
        conflictId: id,
        revision: 1,
        recordIds: receipt.mutation.changes.map((change) => change.recordId),
        alternativeOperationIds: [id],
      });
    }
  }
}
