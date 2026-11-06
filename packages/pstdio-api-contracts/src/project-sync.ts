import type { ProjectFolderRecoveryStatus } from "./project-folder-recovery";

/**
 * Derived on each read from the local document, asset and relay connection owners. Never stored.
 * `local` means the project does not sync. `offline` only means the Cloud connection is lost.
 */
export type ProjectSyncState =
  | "local"
  | "waiting-to-sync"
  | "synced"
  | "offline"
  | "first-download-incomplete"
  | "needs-attention";

export interface ProjectSyncStatus {
  state: ProjectSyncState;
  /** All known documents and required asset bytes have been verified locally. */
  offlineReady: boolean;
  /** Distinct sync documents with unacknowledged local changes, including record streams. Not a record count. */
  pendingItems?: number;
  /** Verified sync documents, including their required files. Total is null until every directory is known. */
  download?: { completed: number; total: number | null };
  /**
   * Folder capture, download and restore progress, separate from records: records can be
   * ready while folder bytes are still pending. Absent until this project connects to Cloud.
   */
  folder?: ProjectFolderRecoveryStatus;
}
