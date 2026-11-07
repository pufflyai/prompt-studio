import type { AccountStatus, ProjectSyncStatus } from "@pstdio/sdk/extensions";

export const cloudStatus = (account: AccountStatus, sync: ProjectSyncStatus) => {
  if (account.signInRequired) return { key: "signInAgain", icon: "user-round-key", warning: true };
  if (!account.login) return { key: "signIn", icon: "user-round-key" };
  if (!account.features?.relay) return { key: "signedIn", icon: "cloud" };
  if (sync.state === "local") return { key: "local", icon: "cloud-off" };
  if (sync.state === "offline") return { key: "offline", icon: "wifi-off", warning: true };
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
  return { key: "synced", icon: "circle-check", success: true };
};
