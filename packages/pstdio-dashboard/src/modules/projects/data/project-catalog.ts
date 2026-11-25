import type { CloudProjectCatalog, DeviceLogin, ProjectCopyAccount } from "@pstdio/sdk/client";
import { accountEvents } from "@pstdio/sdk/extensions";
import { useScopedQuery } from "@pstdio/sdk/extensions/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { getRuntimeApiClient } from "@/lib/api";
import { getDashboardAccountStatusQuery } from "@/lib/scoped-queries";
import { getRuntimeCollections } from "@/lib/sync/collections";
import { subscribeToExtensionEventFeed } from "@/shared/extensions/extension-webview-broadcast";
import { projectTeamAccountId } from "./project-copy-scope";

export const cloudProjectCatalogKey = ["cloud-project-catalog"] as const;

export const cloudCatalogKeyFor = (
  managerOrigin?: string,
  accountId?: string,
  deviceId?: string,
  projectAccountId = accountId,
) => [...cloudProjectCatalogKey, managerOrigin, accountId, deviceId, projectAccountId] as const;

export const cloudProjectDeletionKey = (id: string, account?: ProjectCopyAccount, login?: DeviceLogin) =>
  ["project-cloud-deletion", login?.managerOrigin, login?.accountId, login?.deviceId, account?.accountId, id] as const;

export const useCloudProjectCatalog = (selectedAccountId?: string, forProjectId?: string) => {
  const runtime = getRuntimeCollections();
  const accountStatus = getDashboardAccountStatusQuery(runtime);
  const { data: status, fetching } = useScopedQuery(accountStatus);
  const login = status?.login;
  const queryClient = useQueryClient();
  const signedIn = Boolean(login && !status?.signInRequired);
  const projectAccountId = forProjectId ? projectTeamAccountId(status, forProjectId) : undefined;
  const accountId = selectedAccountId ?? projectAccountId;
  const scopeAccountId = accountId ?? login?.accountId;
  const available =
    signedIn &&
    (!forProjectId || !selectedAccountId || selectedAccountId === projectAccountId) &&
    (!accountId || Boolean(status?.teamAccounts?.some((team) => team.accountId === accountId)));

  useEffect(() => {
    if (!signedIn) return;
    return subscribeToExtensionEventFeed(({ id }) => {
      if (id === accountEvents.changed.id) {
        void queryClient.invalidateQueries({ queryKey: cloudProjectCatalogKey });
      }
    });
  }, [signedIn, queryClient]);

  const catalog = useQuery({
    queryKey: cloudCatalogKeyFor(login?.managerOrigin, login?.accountId, login?.deviceId, scopeAccountId),
    enabled: available,
    queryFn: async ({ signal }) => {
      if (!available || !login) throw new Error("The active Cloud account changed");
      const catalog = await getRuntimeApiClient(runtime).account.projectsCatalog({
        signal,
        accountId,
        expectedDevice: login,
      });
      if (catalog.account?.accountId !== scopeAccountId || catalog.account?.managerOrigin !== login.managerOrigin)
        throw new Error("The active Cloud account changed");
      return catalog;
    },
    retry: false,
    refetchInterval: ({ state }: { state: { data?: CloudProjectCatalog } }) =>
      state.data?.deletions.length ||
      state.data?.projects.some(({ presence }) => presence === "downloading" || presence === "removing")
        ? 1500
        : false,
  });
  return {
    ...catalog,
    data: available ? catalog.data : undefined,
    signedIn,
    login,
    teamAccounts: status?.teamAccounts ?? [],
    teamProjects: status?.teamProjects ?? {},
    teamProjectOwners: status?.teamProjectOwners ?? {},
    accountId,
    signInRequired: Boolean(status?.signInRequired),
    scope: JSON.stringify([
      String(runtime.id),
      login?.managerOrigin,
      login?.accountId,
      login?.deviceId,
      scopeAccountId,
      available,
    ]),
    accountKnown: Boolean(status),
    accountUnconfirmed: fetching || Boolean(accountStatus.getSnapshot().error),
    membershipKnown: (available ? catalog.data?.membershipKnown : undefined) ?? status?.cloudProjectsLoaded,
  };
};
