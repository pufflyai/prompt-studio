import type { ProjectSyncStatus } from "@pstdio/sdk/client";
import { accountEvents } from "@pstdio/sdk/extensions";
import { useScopedQueries, useScopedQuery } from "@pstdio/sdk/extensions/react";
import { getRuntimeApiClient } from "@/lib/api";
import { getDashboardAccountStatusQuery, getDashboardScopedQueries } from "@/lib/scoped-queries";
import { getRuntimeCollections } from "@/lib/sync/collections";

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
  const owner = getRuntimeCollections();
  const account = useScopedQuery(getDashboardAccountStatusQuery(owner));
  const cloudProjects = new Set(account.data?.cloudProjects ?? []);
  const cloudIds = projectIds.filter((id) => cloudProjects.has(id));
  const statuses = useScopedQueries(
    cloudIds.map((projectId) =>
      getDashboardScopedQueries(owner)
        .forScope({ projectId })
        .query({
          id: "project.syncStatus",
          dependsOn: [accountEvents.projectSyncChanged.id, accountEvents.changed.id],
          read: (signal) => getRuntimeApiClient(owner).account.projectSyncStatus(projectId, { signal }),
        }),
    ),
  );
  const signedIn = Boolean(account.data?.login);
  return (projectId: string) => {
    const index = cloudIds.indexOf(projectId);
    return { signedIn, cloud: index !== -1, sync: statuses[index]?.data } satisfies ProjectCloudState;
  };
};
