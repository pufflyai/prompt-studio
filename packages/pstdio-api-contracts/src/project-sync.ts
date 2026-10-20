/** Read from the local durability and relay owners. Never persisted by the UI. */
export type ProjectSyncState =
  | "saved-locally"
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
