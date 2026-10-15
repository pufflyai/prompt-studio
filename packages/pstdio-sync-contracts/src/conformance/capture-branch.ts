import type { Mutation } from "../wire";
import { own } from "./dictionary";
import type { LocalState } from "./local-store";

export function captureBranch(state: LocalState, rootId: string) {
  const available = new Map(
    Object.values(state.accepted.receipts).map((receipt) => [receipt.operationId, receipt.mutation]),
  );
  for (const mutation of state.pending) available.set(mutation.operationId, mutation);
  const captured = new Set([rootId]);
  // Include descendants and all nonaccepted prerequisites of every included group.
  let changed = true;
  while (changed) {
    const before = captured.size;
    for (const pending of state.pending)
      if (pending.parents.some((id) => captured.has(id))) captured.add(pending.operationId);
    for (const id of captured) {
      const mutation = available.get(id);
      if (!mutation) throw new Error("captured branch is unavailable");
      for (const parent of mutation.parents)
        if (own(state.accepted.receipts, parent)?.status !== "accepted") captured.add(parent);
    }
    changed = captured.size !== before;
  }
  return orderBranch(available, captured);
}

function orderBranch(available: Map<string, Mutation>, captured: Set<string>) {
  const ordered: Mutation[] = [];
  const remaining = new Set(captured);
  while (remaining.size) {
    const ready = [...remaining].filter((id) => available.get(id)!.parents.every((parent) => !remaining.has(parent)));
    if (!ready.length) throw new Error("cyclic captured branch");
    for (const id of ready) {
      ordered.push(available.get(id)!);
      remaining.delete(id);
    }
  }
  return ordered;
}
