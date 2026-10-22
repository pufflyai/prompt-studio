import { AsyncLocalStorage } from "node:async_hooks";
import type { StorageOwner } from "pstdio-sync";
import type { StorageGroup } from "pstdio-sync-contracts";

const observations = new AsyncLocalStorage<Record<string, string>>();
const keyFor = (owner: StorageOwner, recordId: string) =>
  JSON.stringify([owner.workbenchId, owner.extensionId, recordId]);
export const observeStorageRecord = <T extends { recordId: string; revision: string }>(
  owner: StorageOwner,
  record: T,
) => {
  const observed = observations.getStore();
  if (observed) observed[keyFor(owner, record.recordId)] = record.revision;
  return record;
};
export const withoutStorageObservation = <T>(action: () => Promise<T>) => observations.exit(action);
export const withStorageObservation = async <T>(_expected: Record<string, string>, action: () => Promise<T>) => {
  const versions: Record<string, string> = {};
  const value = await observations.run(versions, action);
  return { value, versions };
};
export const storageObserver = {
  read: (owner: StorageOwner, record: { recordId: string; revision: string }) => {
    observeStorageRecord(owner, record);
  },
  group: (_owner: StorageOwner, group: StorageGroup) => group,
  committed: (owner: StorageOwner, records: { recordId: string; revision: string }[]) => {
    for (const record of records) observeStorageRecord(owner, record);
  },
};
