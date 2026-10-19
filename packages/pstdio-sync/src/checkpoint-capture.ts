import type { Change } from "pstdio-sync-contracts";
import type { GroupedState, GroupedStore } from "./types";

function combineShared(first: Change, change: Change) {
  if (change.shared?.kind !== "map") {
    if (change.shared) first.shared = change.shared;
    return;
  }
  if (first.shared && first.shared.kind !== "map") throw new Error("Checkpoint primitive changed");
  const entries = new Map((first.shared?.entries ?? []).map((entry) => [entry.key, entry]));
  for (const entry of change.shared.entries)
    entries.set(entry.key, { ...entry, expected: entries.get(entry.key)?.expected ?? entry.expected });
  first.shared = { kind: "map", entries: [...entries.values()] };
}
function combineChange(first: Change | undefined, change: Change) {
  if (!first) return structuredClone(change);
  if (change.value) first.value = { expected: first.value?.expected ?? change.value.expected, next: change.value.next };
  if (change.asset) first.asset = { base: first.asset ? first.asset.base : change.asset.base, next: change.asset.next };
  combineShared(first, change);
  if (change.deleted !== undefined) first.deleted = change.deleted;
  return first;
}

/** Prepare one checkpoint from ordinary save-handler writes. The caller stages bytes and publishes once. */
export async function captureCheckpoint<T>(
  state: GroupedState,
  environmentId: string,
  action: (store: GroupedStore) => Promise<T>,
  observer?: GroupedStore["observer"],
) {
  const fork = structuredClone(state);
  const store: GroupedStore = {
    observer,
    transaction: async (owner, run) => {
      if (owner.workbenchId !== state.owner.workbenchId || owner.extensionId !== state.owner.extensionId)
        throw new Error("A checkpoint cannot cross its storage owner");
      return run(fork);
    },
  };
  const value = await action(store);
  const entries = fork.journal.slice(state.journal.length);
  const internal = new Set(entries.map((entry) => entry.mutation.operationId));
  const changes = new Map<string, Change>();
  const revisions = new Map<string, number>();
  const parents = new Set<string>();
  for (const { mutation } of entries) {
    if (mutation.environmentId !== environmentId || mutation.resolution)
      throw new Error("Unsupported checkpoint authoring operation");
    for (const parent of mutation.parents) if (!internal.has(parent)) parents.add(parent);
    for (const change of mutation.changes) {
      const previous = revisions.get(change.recordId);
      if (previous !== undefined && change.expectedRevision !== previous + 1)
        throw new Error("Checkpoint writes must observe earlier captured writes; preserve the recovery proposal");
      revisions.set(change.recordId, change.expectedRevision);
      changes.set(change.recordId, combineChange(changes.get(change.recordId), change));
    }
  }
  return { value, changes: [...changes.values()], parents: [...parents] };
}
