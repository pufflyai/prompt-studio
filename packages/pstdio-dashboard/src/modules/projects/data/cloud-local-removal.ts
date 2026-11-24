import type { CloudProjectCatalog, ProjectCopyAccount, RemoveLocalProjectResult } from "@pstdio/sdk/client";
import { classifyApiWrite, getWorkbenchOperations } from "@pstdio/workbench";
import { useSyncExternalStore } from "react";
import { getRuntimeApiClient } from "@/lib/api";
import { getDashboardQueryClient } from "@/lib/query-client";
import { getDashboardAccountStatusQuery, getDashboardScopedQueries } from "@/lib/scoped-queries";
import { createRuntimeState } from "@/lib/sync/runtime-state";
import { dashboardCommandIds } from "@/shared/app/commands";
import {
  cloudCopyScopeFor,
  cloudCopySyncKey,
  cloudProjectCopySubject,
  getCloudCopyDownloads,
} from "./cloud-copy-download";
import { cloudCatalogKeyFor, cloudCatalogScopeFor } from "./project-catalog";

const getCloudLocalRemoval = createRuntimeState((owner) => {
  const queries = getDashboardScopedQueries(owner);
  const operations = getWorkbenchOperations(queries);
  const api = getRuntimeApiClient(owner).account;
  const client = getDashboardQueryClient(owner);
  const domain = "project.remove-device-copy";
  const active = (id: string) =>
    operations.getSnapshot().pending.some((entry) => entry.subjects.includes(cloudProjectCopySubject(id)));
  return {
    active,
    isRemoving: (id: string) =>
      operations
        .getSnapshot()
        .pending.some((entry) => entry.domain === domain && entry.subjects.includes(cloudProjectCopySubject(id))),
    snapshot: operations.getSnapshot,
    subscribe: operations.subscribe,
    preflight: (id: string, signal: AbortSignal) => api.projectLocalRemoval(id, { signal }),
    async remove(id: string, name: string, expectedAccount: ProjectCopyAccount, discardUnsynced: boolean) {
      const { accountId, accountOrigin } = queries.getScope();
      if (accountId !== expectedAccount.accountId || accountOrigin !== expectedAccount.managerOrigin)
        throw new Error("The active Cloud account changed. Reopen this action to confirm again.");
      if (active(id)) throw new Error("This project already has a pending Cloud change.");
      const login = getDashboardAccountStatusQuery(owner).getSnapshot().data?.login;
      const scope = cloudCopyScopeFor(id, cloudCatalogScopeFor(String(owner.id), login));
      const catalogKey = cloudCatalogKeyFor(accountOrigin, accountId, login?.deviceId);
      const syncKey = cloudCopySyncKey(scope);
      return operations.submit<RemoveLocalProjectResult>({
        domain,
        subjects: [cloudProjectCopySubject(id)],
        title: `Delete local version of “${name}”`,
        sourceCommand: { id: dashboardCommandIds.openProjects },
        draft: { projectId: id, name, discardUnsynced },
        classify: classifyApiWrite,
        async write(signal) {
          const removed = await api.removeLocalProject(id, { discardUnsynced, expectedAccount }, { signal });
          if (removed.projectId !== id || removed.presence !== "cloud-only")
            throw new SyntaxError("The local removal did not return a matching receipt.");
          return removed;
        },
        async reconcile(receipt, signal) {
          const downloads = getCloudCopyDownloads(owner);
          if (!downloads.isCurrent(id, scope)) return;
          await Promise.all([
            client.cancelQueries({ queryKey: catalogKey, exact: true }),
            client.cancelQueries({ queryKey: syncKey, exact: true }),
          ]);
          signal.throwIfAborted();
          if (!downloads.isCurrent(id, scope)) return;
          // The receipt retires the local copy while the shared project action is still occupied.
          downloads.localCopyRemoved(scope);
          client.getQueryCache().find({ queryKey: syncKey, exact: true })?.reset();
          client.setQueryData<CloudProjectCatalog>(
            catalogKey,
            (previous) =>
              previous && {
                ...previous,
                projects: previous.projects.map((entry) =>
                  entry.id === id
                    ? {
                        ...entry,
                        presence: receipt.presence,
                        downloadError: undefined,
                        actions: { ...entry.actions, download: false, removeLocal: false },
                      }
                    : entry,
                ),
              },
          );
          void client.invalidateQueries({ queryKey: catalogKey, exact: true }, { cancelRefetch: false });
        },
        async check(signal) {
          const catalog = await api.projectsCatalog({ signal });
          if (catalog.account?.accountId !== accountId || catalog.account?.managerOrigin !== accountOrigin)
            return { status: "unknown" };
          const copy = catalog.projects.find((entry) => entry.id === id);
          if (copy?.presence === "cloud-only")
            return { status: "confirmed", result: { projectId: id, presence: "cloud-only" } };
          if (copy?.presence === "removing")
            return { status: "rejected", error: new Error("Return to Projects to resume removal of this copy.") };
          return { status: "unknown" };
        },
      }).result;
    },
  };
});

export const useCloudLocalRemoval = () => {
  const removal = getCloudLocalRemoval();
  useSyncExternalStore(removal.subscribe, removal.snapshot, removal.snapshot);
  return removal;
};
