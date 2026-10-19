import type {
  RecordEdit,
  StorageConflict,
  StorageConflictInspection,
  StorageGroup,
  StorageRecord,
  StorageResolution,
  StorageSaveOutcome,
} from "pstdio-sync-contracts";

/** Pure domain merge. No host context or effects. Return null when no merge is possible. */
export type StorageConflictHandler = (
  inspection: StorageConflictInspection,
) => RecordEdit[] | null | Promise<RecordEdit[] | null>;

export type {
  SharedEdit as SharedStorageEdit,
  StorageConflict,
  StorageConflictInspection,
  StorageGroup,
  StorageRecord,
  StorageResolution,
  StorageSaveOutcome,
} from "pstdio-sync-contracts";

/** One extension's shared content within the current workbench. All methods use complete record addresses. */
export interface ExtensionRecordsApi {
  /** Stable complete record address for a key in the selected legacy storage scope. */
  id(key: string): string;
  read(recordId: string, branch?: { operationId: string }): Promise<StorageRecord>;
  /** List the owner's current saved records across scopes. Tombstones are available through read. */
  list(): Promise<StorageRecord[]>;
  /** Save the entire group durably. Reuse the operation ID only for an identical request. */
  commit(group: StorageGroup): Promise<StorageSaveOutcome>;
  outcome(operationId: string): Promise<StorageSaveOutcome | undefined>;
  conflicts(): Promise<StorageConflict[]>;
  inspect(conflictId: string): Promise<StorageConflictInspection>;
  /** Resolve exactly the inspected branch. Late edits remain retained. */
  resolve(proposal: StorageResolution): Promise<StorageSaveOutcome>;
}
