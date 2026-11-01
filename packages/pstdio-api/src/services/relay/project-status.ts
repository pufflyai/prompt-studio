import type { ProjectSyncStatus } from "pstdio-api-contracts";

interface OwnerSyncStatus {
  /** The owner finished one full download since its relay connection started. Reconnects keep it. */
  firstDownloaded: boolean;
  /** All content the relay announced so far is verified on this device. */
  downloaded: boolean;
  pending: boolean;
  needsAttention: boolean;
  connected: boolean;
  busy: boolean;
  pendingItems?: number;
  download?: { completed: number; total: number | null };
}

export const projectSyncStatus = (owners: OwnerSyncStatus[]) => {
  const offlineReady = owners.every((owner) => owner.downloaded && !owner.needsAttention);
  let state: ProjectSyncStatus["state"] = "synced";
  if (owners.some((owner) => owner.needsAttention)) state = "needs-attention";
  else if (owners.some((owner) => !owner.firstDownloaded)) state = "first-download-incomplete";
  else if (owners.some((owner) => !owner.connected)) state = "offline";
  else if (owners.some((owner) => owner.pending || owner.busy || !owner.downloaded)) state = "waiting-to-sync";
  return {
    state,
    offlineReady,
    pendingItems: owners.every((owner) => owner.pendingItems !== undefined)
      ? owners.reduce((sum, owner) => sum + (owner.pendingItems ?? 0), 0)
      : undefined,
    download: {
      completed: owners.reduce((sum, owner) => sum + (owner.download?.completed ?? 0), 0),
      total: owners.every((owner) => owner.download?.total != null)
        ? owners.reduce((sum, owner) => sum + (owner.download?.total ?? 0), 0)
        : null,
    },
  };
};
