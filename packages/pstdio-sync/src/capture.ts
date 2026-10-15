import { orderOperations } from "./graph";
import { pendingOperations } from "./journal";
import type { GroupedState } from "./types";

export const captureBranch = (
  state: GroupedState,
  environmentId: string,
  rootId: string,
  published = new Set<string>(),
) => {
  const available = new Map(state.journal.map((entry) => [entry.mutation.operationId, entry.mutation]));
  const captured = new Set([rootId]);
  const pending = pendingOperations(state, environmentId);
  let changed = true;
  while (changed) {
    const before = captured.size;
    for (const mutation of pending.filter((operation) => !published.has(operation.operationId)))
      if (mutation.parents.some((parent) => captured.has(parent))) captured.add(mutation.operationId);
    for (const id of captured) {
      const mutation = available.get(id);
      if (!mutation) throw new Error("Captured branch is unavailable");
      for (const parent of mutation.parents)
        if (state.accepted?.receipts[parent]?.status !== "accepted" && !published.has(parent)) captured.add(parent);
    }
    changed = captured.size !== before;
  }
  return orderOperations(available, captured);
};
