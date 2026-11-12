import type { AccountStatus, ProjectSyncStatus } from "@pstdio/sdk/extensions";
import type { CloudProjectState } from "./project-state";

export const cloudStatus = (
  account: AccountStatus | undefined,
  sync: ProjectSyncStatus | undefined,
  project?: CloudProjectState,
  online = true,
) => {
  if (!online || sync?.state === "offline") return { key: "offline", icon: "wifi-off", warning: true };
  if (!account || !sync) return { key: "loading", icon: "cloud" };
  if (account.signInRequired) return { key: "signInAgain", icon: "user-round-key", warning: true };
  if (!account.login) return { key: "signIn", icon: "user-round-key" };
  if (!account.features?.relay) return { key: "signedIn", icon: "cloud" };
  if (sync.state === "local") return { key: "local", icon: "cloud-off" };
  if (sync.state === "needs-attention") return { key: "attention", icon: "triangle-alert", warning: true };
  if (sync.state === "first-download-incomplete") {
    const progress = sync.download;
    const percent =
      progress?.total && progress.completed < progress.total
        ? Math.floor((progress.completed / progress.total) * 100)
        : undefined;
    return { key: "downloading", icon: "cloud-download", warning: true, active: true, percent };
  }
  if (sync.state === "waiting-to-sync") {
    return { key: "syncing", icon: "cloud-upload", active: true, count: sync.pendingItems };
  }
  if (project?.state === "failed") return { key: "attention", icon: "triangle-alert", warning: true };
  if (project?.state === "preparing" && sync.offlineReady) return { key: "preparing", icon: "folder", active: true };
  return { key: "synced", icon: "circle-check", success: true };
};
