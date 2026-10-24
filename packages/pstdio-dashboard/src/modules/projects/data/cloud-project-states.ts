import type { ProjectSyncStatus } from "@pstdio/sdk/client";
import { useQueries, useQuery } from "@tanstack/react-query";
import { getApiClient } from "@/lib/api";

// The picker is open briefly, and a new device's download finishes while it is open.
const REFRESH_MS = 2000;

export interface ProjectCloudState {
  /** This device is signed in to a Cloud account. */
  signedIn: boolean;
  /** The project syncs with the account. */
  cloud: boolean;
  /** Its sync state on this device, once read. */
  sync?: ProjectSyncStatus;
}

/** Which projects sync with the account, and how far each cloud project is on this device. */
export const useCloudProjectStates = (projectIds: string[]) => {
  const account = useQuery({
    queryKey: ["account-status"],
    queryFn: () => getApiClient().account.status(),
    refetchInterval: REFRESH_MS,
  });
  const cloudProjects = new Set(account.data?.cloudProjects ?? []);
  const cloudIds = projectIds.filter((id) => cloudProjects.has(id));
  const statuses = useQueries({
    queries: cloudIds.map((id) => ({
      queryKey: ["project-sync-status", id],
      queryFn: () => getApiClient().account.projectSyncStatus(id),
      refetchInterval: REFRESH_MS,
    })),
  });
  const signedIn = Boolean(account.data?.login);
  return (projectId: string) => {
    const index = cloudIds.indexOf(projectId);
    return { signedIn, cloud: index !== -1, sync: statuses[index]?.data } satisfies ProjectCloudState;
  };
};
