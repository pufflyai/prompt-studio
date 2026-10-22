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
}
