import type { LocalRemovalPreflight, ProjectSyncStatus } from "pstdio-api-contracts";

export type LocalCleanupSummary = Pick<
  LocalRemovalPreflight,
  "removesManagedFolder" | "retainsUnverifiedFolder" | "providerWorkspaceCount" | "providerWorkspaceNames"
>;

const uploadState = (
  status: ProjectSyncStatus | undefined,
  online: boolean,
  cleanup: LocalCleanupSummary,
  returned: LocalRemovalPreflight["uploadState"],
): LocalRemovalPreflight["uploadState"] => {
  const uploading = status?.sources?.some((source) =>
    source.files.some((file) => file.direction === "upload" && file.status !== "completed"),
  );
  const capture = status?.folder?.capture.state;
  if (capture === "running" || capture === "pending") return "pending";
  if (uploading || (status?.pendingItems ?? 0) > 0 || returned === "pending") return "pending";
  // Record sync cannot certify untracked or excluded bytes in a folder or provider workspace.
  if (cleanup.removesManagedFolder || cleanup.providerWorkspaceCount || capture === "needs-attention") return "unknown";
  if (returned === "verified" && online && status?.state === "synced" && status.offlineReady) return "verified";
  return "unknown";
};

export const localRemovalPreflight = (
  project: { id: string; name: string },
  summary: LocalCleanupSummary,
  status: ProjectSyncStatus | undefined,
  online: boolean,
  returned: LocalRemovalPreflight["uploadState"],
): LocalRemovalPreflight => {
  const state = uploadState(status, online, summary, returned);
  return {
    projectId: project.id,
    name: project.name,
    uploadState: state,
    requiresDiscard: state !== "verified",
    ...summary,
  };
};
