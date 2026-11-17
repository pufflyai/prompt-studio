import type { ProjectFolderRecoveryStatus, ProjectSyncSource } from "pstdio-api-contracts";
import { apiLogger } from "../../lib/logger";
import { projectSyncStatus } from "./project-status";

const missingOwnerStatus = {
  firstDownloaded: false,
  downloaded: false,
  pending: false,
  needsAttention: false,
  connected: false,
  busy: false,
};
type OwnerStatus = Parameters<typeof projectSyncStatus>[0][number] & Partial<ProjectSyncSource>;
export const readOwnerStatus = async (owner: { status(): Promise<OwnerStatus> } | undefined) =>
  owner ? { ...(await owner.status()), canRetry: true } : { ...missingOwnerStatus, canRetry: false };
export const projectOwnerProgress = (
  workbenchId: string,
  statuses: OwnerStatus[],
  extensionIds: string[],
  extensionNames: string[],
  /** Folder progress sits beside records and never makes them unready. */
  folder?: ProjectFolderRecoveryStatus,
) => {
  const names = ["core", "publications", "automations", "activity", "personal", ...extensionIds];
  const labels = [
    "Project information",
    "Extensions",
    "Automations",
    "Resource Activity",
    "Sessions and history",
    ...extensionNames,
  ];
  apiLogger.debug(
    {
      event: "relay.project.status",
      workbenchId,
      owners: statuses.map((status, index) => ({ owner: names[index], ...status })),
    },
    "Project data owner progress",
  );
  const sources = statuses.map((status, index) => ({
    id: names[index]!,
    name: labels[index]!,
    canRetry: status.canRetry ?? false,
    connected: status.connected,
    busy: status.busy,
    downloaded: status.downloaded,
    phase: status.phase ?? (status.downloaded && !status.busy ? "ready" : "synchronizing-records"),
    phaseStartedAt: status.phaseStartedAt,
    lastProgressAt: status.lastProgressAt,
    startedAt: status.startedAt,
    completedAt: status.completedAt,
    error: status.error,
    download: status.download,
    files: status.files ?? [],
  }));
  return { ...projectSyncStatus(statuses), sources, ...(folder ? { folder } : {}) };
};
