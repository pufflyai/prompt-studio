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

/** One record this device changed, named by its resource number when it has one. */
export interface ProjectReturnRecord {
  extensionId: string;
  recordId: string;
  /** Resource number such as `PS-2`. */
  label?: string;
  /** JSON Pointers inside the record value, such as `/assignee`. */
  fields: string[];
  deleted: boolean;
}

/** What a device does with changes from its time away: upload held ones, drop them, or clear replaced notices. */
export type ProjectReturnAction = "apply" | "discard" | "dismiss";

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
  /** Independent data owners, pending internal work and recent file transfers. */
  sources?: ProjectSyncSource[];
  /**
   * Changes this device made while signed out, or a return held for review. Signed-out changes upload
   * when the device signs in again; held changes upload only after someone applies them here.
   * Lists are capped; totals count every record.
   */
  away?: {
    state: "signed-out" | "held";
    total: number;
    deletions: number;
    records: (ProjectReturnRecord & { created: boolean })[];
  };
  /** This device's changes that Cloud did not apply because another device changed them first. */
  replaced?: { total: number; records: (ProjectReturnRecord & { whole: boolean; replacedAt: number })[] };
}

export interface ProjectSyncFile {
  id: string;
  name?: string;
  direction: "upload" | "download";
  status: "queued" | "active" | "completed" | "failed";
  byteLength: number;
  /** Encrypted bytes received, or acknowledged by Cloud for uploads. Includes resumed bytes. */
  completedBytes: number;
  totalBytes: number;
}

export interface ProjectSyncSource {
  id: string;
  name?: string;
  canRetry?: boolean;
  phase: string;
  lastProgressAt?: string;
  phaseStartedAt?: string;
  startedAt?: string;
  completedAt?: string;
  connected: boolean;
  busy: boolean;
  downloaded: boolean;
  download?: { completed: number; total: number | null };
  error?: string;
  files: ProjectSyncFile[];
}
