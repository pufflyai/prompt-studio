import type { AssetStore, StorageObserver } from "pstdio-sync";
import type { createProjectionStatistics } from "./projection-statistics";
import type { NumberChange } from "./resource-number-repair";
import type { StorageDiagnostics } from "./storage-diagnostics";

export interface RecordDependencies {
  /** Resolves once the owner's records no longer live in its owner document. */
  statistics: ReturnType<typeof createProjectionStatistics>;
  /** Notifies owner watchers after a commit. */
  changed: (recordIds?: readonly string[]) => void;
  nativeChanged?: (keys: string[]) => void;
  numbersChanged?: (events: NumberChange[]) => void;
  observer?: StorageObserver;
  assets?: AssetStore;
  diagnostics?: StorageDiagnostics;
}
