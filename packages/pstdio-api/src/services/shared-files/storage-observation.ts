import { AsyncLocalStorage } from "node:async_hooks";
import { type StorageOwner, StorageRevisionChangedError } from "pstdio-sync";
import type { StorageGroup } from "pstdio-sync-contracts";

const observations = new AsyncLocalStorage<{
  versions: Record<string, string>;
  expected: Record<string, string>;
}>();
const keyFor = (owner: StorageOwner, recordId: string) =>
  JSON.stringify([owner.workbenchId, owner.extensionId, recordId]);
export const isObservingStorage = () => observations.getStore() !== undefined;
export const observeStorageVersion = (key: string, revision: string) => {
  const observed = observations.getStore();
  if (observed) {
    observed.versions[key] = revision;
    observed.expected[key] ??= revision;
  }
};
export const commitStorageVersion = (key: string, revision: string) => {
  observeStorageVersion(key, revision);
  const observed = observations.getStore();
  if (observed) observed.expected[key] = revision;
};
export const assertStorageVersion = (key: string, revision: string) => {
  const expected = observations.getStore()?.expected[key];
  if (expected !== undefined && expected !== revision) throw new StorageRevisionChangedError();
};
export const observeStorageRecord = <T extends { recordId: string; revision: string }>(
  owner: StorageOwner,
  record: T,
) => {
  observeStorageVersion(keyFor(owner, record.recordId), record.revision);
  return record;
};
export const withoutStorageObservation = <T>(action: () => Promise<T>) => observations.exit(action);
export const withStorageObservation = async <T>(expected: Record<string, string>, action: () => Promise<T>) => {
  const versions: Record<string, string> = {};
  const value = await observations.run({ versions, expected: { ...expected } }, action);
  return { value, versions };
};
export const storageObserver = {
  expected: (owner: StorageOwner, recordId: string) => observations.getStore()?.expected[keyFor(owner, recordId)],
  read: (owner: StorageOwner, record: { recordId: string; revision: string }) => {
    observeStorageRecord(owner, record);
  },
  group: (_owner: StorageOwner, group: StorageGroup) => group,
  committed: (owner: StorageOwner, records: { recordId: string; revision: string }[]) => {
    for (const record of records) {
      commitStorageVersion(keyFor(owner, record.recordId), record.revision);
    }
  },
};
