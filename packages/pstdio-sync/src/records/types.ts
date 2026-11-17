import type { StorageGroup, StorageResolution } from "pstdio-sync-contracts";

/** Legacy local conditions still fence the observed record lifetime at relay order. */
export type GroupCommit = Omit<StorageGroup, "edits"> & {
  edits: (StorageGroup["edits"][number] & { expectedLifetime?: string })[];
};
export type ResolutionCommit = StorageResolution;
