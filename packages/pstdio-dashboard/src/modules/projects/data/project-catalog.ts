import type { AccountStatus, CloudProjectCatalog, ProjectCopyAccount } from "@pstdio/sdk/client";
import { accountEvents } from "@pstdio/sdk/extensions";
import { useScopedQuery } from "@pstdio/sdk/extensions/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { getRuntimeApiClient } from "@/lib/api";
import { getDashboardAccountStatusQuery } from "@/lib/scoped-queries";
import { getRuntimeCollections } from "@/lib/sync/collections";
import { subscribeToExtensionEventFeed } from "@/shared/extensions/extension-webview-broadcast";

export const cloudProjectCatalogKey = ["cloud-project-catalog"] as const;

export const cloudCatalogKeyFor = (managerOrigin?: string, accountId?: string, deviceId?: string) =>
  [...cloudProjectCatalogKey, managerOrigin, accountId, deviceId] as const;

export const cloudProjectDeletionKey = (id: string, account?: ProjectCopyAccount) =>
  ["project-cloud-deletion", account?.managerOrigin, account?.accountId, id] as const;

export const cloudCatalogScopeFor = (runtimeId: string, login?: AccountStatus["login"]) =>
  JSON.stringify([runtimeId, login?.managerOrigin, login?.accountId, login?.deviceId]);

export const useCloudProjectCatalog = () => {
  const runtime = getRuntimeCollections();
  const { data: status, fetching, error } = useScopedQuery(getDashboardAccountStatusQuery(runtime));
  const login = status?.login;
  const queryClient = useQueryClient();
  const signedIn = Boolean(login);

  useEffect(() => {
    if (!signedIn) return;
    return subscribeToExtensionEventFeed(({ id }) => {
      if (id === accountEvents.changed.id) {
        void queryClient.invalidateQueries({ queryKey: cloudProjectCatalogKey });
      }
    });
  }, [signedIn, queryClient]);

  const catalog = useQuery({
    queryKey: cloudCatalogKeyFor(login?.managerOrigin, login?.accountId, login?.deviceId),
    enabled: signedIn,
    queryFn: async ({ signal }) => {
      const catalog = await getRuntimeApiClient(runtime).account.projectsCatalog({ signal });
      if (
        !login ||
        catalog.account?.accountId !== login.accountId ||
        catalog.account?.managerOrigin !== login.managerOrigin
      )
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
    signedIn,
    signInRequired: Boolean(status?.signInRequired),
    scope: cloudCatalogScopeFor(String(runtime.id), login),
    accountKnown: Boolean(status),
    accountUnconfirmed: fetching || Boolean(error),
    membershipKnown: catalog.data?.membershipKnown ?? status?.cloudProjectsLoaded,
  };
};
