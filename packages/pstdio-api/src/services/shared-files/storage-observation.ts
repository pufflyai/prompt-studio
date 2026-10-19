import { AsyncLocalStorage } from "node:async_hooks";
import type { StorageOwner } from "pstdio-sync";
import type { StorageConflict, StorageGroup } from "pstdio-sync-contracts";
import { assertConflictFreeRead } from "./conflict-read-boundary";

const observations = new AsyncLocalStorage<{
  expected: Record<string, string>;
  observed: Record<string, string>;
  conflicted: boolean;
}>();
const keyFor = (owner: StorageOwner, recordId: string) =>
  JSON.stringify([owner.workbenchId, owner.extensionId, recordId]);
export const observeStorageRecord = <T extends { recordId: string; revision: string }>(
  owner: StorageOwner,
  record: T,
) => {
  const context = observations.getStore();
  if (context) context.observed[keyFor(owner, record.recordId)] = record.revision;
  return record;
};
export const expectedStorageGroup = (owner: StorageOwner, group: StorageGroup) => {
  const expected = observations.getStore()?.expected;
  if (!expected) return group;
  return {
    ...group,
    edits: group.edits.map((edit) => ({
      ...edit,
      expectedRevision: expected[keyFor(owner, edit.recordId)] ?? edit.expectedRevision,
    })),
  };
};
export const withoutStorageObservation = <T>(action: () => Promise<T>) => observations.exit(action);
export const withStorageObservation = async <T>(expected: Record<string, string>, action: () => Promise<T>) => {
  const context = { expected: { ...expected }, observed: {}, conflicted: false };
  const value = await observations.run(context, action);
  return { value, versions: context.observed, conflicted: context.conflicted };
};

export const observeStorageOutcome = <T extends { status: string }>(outcome: T) => {
  const context = observations.getStore();
  if (context && outcome.status === "conflict") context.conflicted = true;
  return outcome;
};

export const storageObserver = {
  beforeRead: (_owner: StorageOwner, recordIds: string[], conflicts: StorageConflict[]) =>
    assertConflictFreeRead(recordIds, conflicts),
  read: (owner: StorageOwner, record: { recordId: string; revision: string }) => {
    observeStorageRecord(owner, record);
  },
  group: expectedStorageGroup,
  committed: (owner: StorageOwner, records: { recordId: string; revision: string }[], outcome: { status: string }) => {
    observeStorageOutcome(outcome);
    const context = observations.getStore();
    if (!context || outcome.status === "conflict") return;
    for (const record of records) {
      context.expected[keyFor(owner, record.recordId)] = record.revision;
      observeStorageRecord(owner, record);
    }
  },
};
