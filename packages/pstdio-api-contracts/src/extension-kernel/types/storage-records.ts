import type {
  StorageConflict,
  StorageConflictInspection,
  StorageGroup,
  StorageRecord,
  StorageRecordQueries,
  StorageResolution,
  StorageSaveOutcome,
} from "pstdio-sync-contracts";

export type {
  SharedEdit as SharedStorageEdit,
  StorageAggregateQuery,
  StorageConflict,
  StorageConflictInspection,
  StorageGroup,
  StorageIndexField,
  StoragePredicate,
  StorageQueryPage,
  StorageQueryRecord,
  StorageRecord,
  StorageRecordIndex,
  StorageRecordQueries,
  StorageRecordQuery,
  StorageResolution,
  StorageSaveOutcome,
  StorageSaveState,
} from "pstdio-sync-contracts";

/** One extension's shared content within the current workbench. All methods use complete record addresses. */
export interface ExtensionRecordsApi extends StorageRecordQueries {
  /** Stable complete record address for a key in the selected legacy storage scope. */
  id(key: string): string;
  /** @param branch Deprecated. Retained branches go away because edits merge. Call `read(recordId)`. */
  read(recordId: string, branch?: { operationId: string }): Promise<StorageRecord>;
  /** List the owner's current saved records across scopes. Tombstones are available through read. */
  list(): Promise<StorageRecord[]>;
  /** Save the entire group durably. Reuse the operation ID only for an identical request. */
  commit(group: StorageGroup): Promise<StorageSaveOutcome>;
  /** Current sync state of a save, or undefined for an unknown operation. Poll it to wait until a save has synced. */
  outcome(operationId: string): Promise<StorageSaveOutcome | undefined>;
  /** @deprecated Conflicts go away because edits merge. Remove the call; `outcome` reports saves that need attention. */
  conflicts(): Promise<StorageConflict[]>;
  /** @deprecated Conflicts go away because edits merge. Remove the call. */
  inspect(conflictId: string): Promise<StorageConflictInspection>;
  /** @deprecated Conflicts go away because edits merge. Save the chosen values with `commit`. */
  resolve(proposal: StorageResolution): Promise<StorageSaveOutcome>;
}
