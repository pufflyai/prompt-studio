import type { LocalRemovalPreflight, ProjectSyncStatus } from "pstdio-api-contracts";
import type { createNativeCloudReturn } from "./native-cloud-return";

export type LocalCleanupSummary = Pick<LocalRemovalPreflight, "removesManagedFolder" | "providerWorkspaceCount">;

const uploadState = (status: ProjectSyncStatus | undefined, online: boolean): LocalRemovalPreflight["uploadState"] => {
  const uploading = status?.sources?.some((source) =>
    source.files.some((file) => file.direction === "upload" && file.status !== "completed"),
  );
  if (uploading || (status?.pendingItems ?? 0) > 0 || (status?.away?.total ?? 0) > 0) return "pending";
  if (online && status?.state === "synced" && status.offlineReady) return "verified";
  return "unknown";
};

export const localRemovalPreflight = (
  project: { id: string; name: string },
  summary: LocalCleanupSummary,
  status: ProjectSyncStatus | undefined,
  online: boolean,
): LocalRemovalPreflight => {
  const state = uploadState(status, online);
  return {
    projectId: project.id,
    name: project.name,
    uploadState: state,
    requiresDiscard: state !== "verified",
    ...summary,
  };
};

export const catalogStatus = (
  online: () => boolean,
  syncStatus: (id: string) => Promise<ProjectSyncStatus>,
  away: Pick<ReturnType<typeof createNativeCloudReturn>, "status">,
) => ({
  online,
  async syncStatus(id: string) {
    const [status, returned] = await Promise.all([syncStatus(id), away.status(id)]);
    return { ...status, ...returned };
  },
});
