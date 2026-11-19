import type { CloudProjectCatalog, CloudProjectCatalogEntry, ProjectSyncStatus } from "@pstdio/sdk/client";
import { useScopedQueries, useScopedQuery } from "@pstdio/sdk/extensions/react";
import { getDashboardAccountStatusQuery } from "@/lib/scoped-queries";
import { getRuntimeCollections } from "@/lib/sync/collections";
import { getAccountQuerySources } from "@/shared/extensions/account-queries";

export interface ProjectCloudState {
  /** This device is signed in to a Cloud account. */
  signedIn: boolean;
  membershipKnown?: boolean;
  /** The project syncs with the account. */
  cloud: boolean;
  /** Its sync state on this device, once read. */
  sync?: ProjectSyncStatus;
  presence?: CloudProjectCatalogEntry["presence"];
  deleting?: boolean;
}

/** Which projects sync with the account, and how far each cloud project is on this device. */
export const useCloudProjectStates = (projectIds: string[], catalog?: CloudProjectCatalog) => {
  const owner = getRuntimeCollections();
  const account = useScopedQuery(getDashboardAccountStatusQuery(owner));
  const cloudProjects = new Set(account.data?.cloudProjects ?? []);
  const cloudIds = projectIds.filter((id) => cloudProjects.has(id));
  const statuses = useScopedQueries(
    cloudIds.map((projectId) => getAccountQuerySources(owner).source({ service: "projectSyncStatus", projectId })),
  );
  const signedIn = Boolean(account.data?.login);
  const entries = new Map(catalog?.projects.map((entry) => [entry.id, entry.presence]));
  const deletions = new Set(catalog?.deletions.map((entry) => entry.projectId));
  return (projectId: string) => {
    const index = cloudIds.indexOf(projectId);
    const presence = entries.get(projectId);
    const deleting = deletions.has(projectId);
    return {
      signedIn,
      membershipKnown: catalog?.membershipKnown ?? account.data?.cloudProjectsLoaded,
      cloud: Boolean(presence || deleting || index !== -1),
      sync: statuses[index]?.data,
      presence,
      deleting,
    } satisfies ProjectCloudState;
  };
};
