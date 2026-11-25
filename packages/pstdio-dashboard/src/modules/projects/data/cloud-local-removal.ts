import type { CloudProjectCatalog, ProjectCopyAccount, RemoveLocalProjectResult } from "@pstdio/sdk/client";
import { classifyApiWrite, getWorkbenchOperations } from "@pstdio/workbench";
import { useSyncExternalStore } from "react";
import { getRuntimeApiClient } from "@/lib/api";
import { getDashboardQueryClient } from "@/lib/query-client";
import { getDashboardAccountStatusQuery, getDashboardScopedQueries } from "@/lib/scoped-queries";
import { getRuntimeCollections } from "@/lib/sync/collections";
import { createRuntimeState } from "@/lib/sync/runtime-state";
import { dashboardCommandIds } from "@/shared/app/commands";
import {
  cloudCopyBusy,
  cloudCopyRemovalDomain,
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
  const accountStatus = getDashboardAccountStatusQuery(owner);
  const copyScope = (id: string) =>
    cloudCopyScopeFor(id, cloudCatalogScopeFor(String(owner.id), accountStatus.getSnapshot().data?.login));
  const active = (id: string) => cloudCopyBusy(operations, id, copyScope(id));
  return {
    active,
    isRemoving: (id: string) => {
      const subject = cloudProjectCopySubject(id, copyScope(id));
      return operations
        .getSnapshot()
        .pending.some((entry) => entry.domain === cloudCopyRemovalDomain && entry.subjects.includes(subject));
    },
    snapshot: operations.getSnapshot,
    subscribe: operations.subscribe,
    preflight: (id: string, signal: AbortSignal) => api.projectLocalRemoval(id, { signal }),
    async remove(id: string, name: string, expectedAccount: ProjectCopyAccount, discardUnsynced: boolean) {
      const { accountId, accountOrigin } = queries.getScope();
      if (accountId !== expectedAccount.accountId || accountOrigin !== expectedAccount.managerOrigin)
        throw new Error("The active Cloud account changed. Reopen this action to confirm again.");
      if (active(id)) throw new Error("This project already has a pending Cloud change.");
      const { data, error, fetching } = accountStatus.getSnapshot();
      if (!data?.login || data.signInRequired || error || fetching || accountStatus.inspect().stale)
        throw new Error("Confirm the current Cloud device before removing its local copy.");
      const login = data.login;
      const scope = cloudCopyScopeFor(id, cloudCatalogScopeFor(String(owner.id), login));
      const catalogKey = cloudCatalogKeyFor(accountOrigin, accountId, login?.deviceId);
      const syncKey = cloudCopySyncKey(scope);
      const retiredScope = () => {
        if (owner.isDisposed() || getRuntimeCollections() !== owner) return true;
        const { data } = accountStatus.getSnapshot();
        return Boolean(
          data &&
            (data.signInRequired ||
              scope !== cloudCopyScopeFor(id, cloudCatalogScopeFor(String(owner.id), data.login))),
        );
      };
      const confirmedScope = () => {
        if (retiredScope()) return false;
        const { data, error, fetching } = accountStatus.getSnapshot();
        // Keep the acknowledged receipt recoverable until this device can be confirmed.
        if (!data || error || fetching || accountStatus.inspect().stale)
          throw new Error("Confirm the current Cloud device before reconciling local removal.");
        return true;
      };
      const confirmScope = async (signal: AbortSignal) => {
        if (retiredScope()) return false;
        const { data, error, fetching } = accountStatus.getSnapshot();
        if (fetching) await accountStatus.read(signal);
        else if (!data || error || accountStatus.inspect().stale) await accountStatus.refresh(signal);
        signal.throwIfAborted();
        return confirmedScope();
      };
      return operations.submit<RemoveLocalProjectResult>({
        // The local row can disappear before its receipt; the account owns this operation.
        intent: id,
        domain: cloudCopyRemovalDomain,
        subjects: [cloudProjectCopySubject(id, scope)],
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
          if (!(await confirmScope(signal))) return;
          await Promise.all([
            client.cancelQueries({ queryKey: catalogKey, exact: true }),
            client.cancelQueries({ queryKey: syncKey, exact: true }),
          ]);
          signal.throwIfAborted();
          if (!confirmedScope()) return;
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
          if (!(await confirmScope(signal))) return { status: "unknown" };
          const catalog = await api.projectsCatalog({ signal });
          if (!confirmedScope()) return { status: "unknown" };
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
