import type { ProjectSyncStatus } from "pstdio-api-contracts";

interface ExtensionSyncStatus {
  downloaded: boolean;
  pending: boolean;
  needsAttention: boolean;
  connected: boolean;
  busy: boolean;
}

export const projectSyncStatus = (extensions: ExtensionSyncStatus[]) => {
  const offlineReady = extensions.every((extension) => extension.downloaded && !extension.needsAttention);
  let state: ProjectSyncStatus["state"] = "synced";
  if (extensions.some((extension) => extension.needsAttention)) state = "needs-attention";
  else if (!offlineReady) state = "first-download-incomplete";
  else if (extensions.some((extension) => !extension.connected)) state = "offline";
  else if (extensions.some((extension) => extension.pending || extension.busy)) state = "waiting-to-sync";
  return { state, offlineReady };
};
