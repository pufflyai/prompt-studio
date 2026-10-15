import type { Snapshot } from "../state";

export function completedOperations(snapshot: Snapshot) {
  const completed = new Set<string>();
  for (const receipt of Object.values(snapshot.receipts)) {
    if (receipt.status !== "accepted") continue;
    completed.add(receipt.operationId);
    for (const id of receipt.mutation.resolution?.capturedOperationIds ?? []) completed.add(id);
  }
  return completed;
}
