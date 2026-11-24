import type { CloudProjectCatalog, ProjectCopyAccount, ProjectCopyDevice, RemoveLocalProjectResult } from "@pstdio/sdk/client";
import { classifyApiWrite, getWorkbenchOperations } from "@pstdio/workbench";
import { useSyncExternalStore } from "react";
import { getRuntimeApiClient } from "@/lib/api";
import { getDashboardQueryClient } from "@/lib/query-client";
import { getDashboardScopedQueries } from "@/lib/scoped-queries";
import { createRuntimeState } from "@/lib/sync/runtime-state";
import { getCloudCopyDownloads } from "./cloud-copy-download";
import { cloudCatalogKeyFor } from "./project-catalog";
import {
  cloudCopyBusy,
  cloudCopySourceCommand,
  cloudCopySyncKey,
  cloudProjectCopySubject,
  deviceProjectCopySubject,
  requireProjectCopyScope,
} from "./project-copy-scope";

const getCloudLocalRemoval = createRuntimeState((owner) => {
  const queries = getDashboardScopedQueries(owner);
  const operations = getWorkbenchOperations(queries);
  const api = getRuntimeApiClient(owner).account;
  const client = getDashboardQueryClient(owner);
  const domain = "project.remove-device-copy";
  const active = (id: string, account?: ProjectCopyAccount, device?: ProjectCopyDevice) =>
    cloudCopyBusy(operations, id, account, device);
  return {
    active,
    isRemoving(id: string, account?: ProjectCopyAccount, device?: ProjectCopyDevice) {
      if (!account || !device) return false;
      const subject = deviceProjectCopySubject(id, account, device);
      return operations.getSnapshot().pending.some((entry) => entry.domain === domain && entry.subjects.includes(subject));
    },
    snapshot: operations.getSnapshot,
    subscribe: operations.subscribe,
    preflight: (id: string, expectedDevice: ProjectCopyDevice, signal: AbortSignal) =>
      api.projectLocalRemoval(id, { signal, expectedDevice }),
    async remove(
      id: string,
      name: string,
      expectedAccount: ProjectCopyAccount,
      expectedDevice: ProjectCopyDevice,
      discardUnsynced: boolean,
    ) {
      const scope = requireProjectCopyScope(
        owner,
        id,
        expectedAccount,
        expectedDevice,
        "The active Cloud account changed. Reopen this action to confirm again.",
      );
      if (active(id, expectedAccount, expectedDevice)) throw new Error("This project already has a pending Cloud change.");
      const { managerOrigin, accountId, deviceId } = scope.login;
      const catalogKey = cloudCatalogKeyFor(managerOrigin, accountId, deviceId, expectedAccount.accountId);
      const syncKey = cloudCopySyncKey(scope.key);
      return operations.submit<RemoveLocalProjectResult>({
        // The native removal clears the local project's scope before its receipt arrives.
        domain,
        subjects: [deviceProjectCopySubject(id, expectedAccount, expectedDevice)],
        intent: cloudProjectCopySubject(id, expectedAccount),
        title: `Delete local version of “${name}”`,
        sourceCommand: cloudCopySourceCommand(scope.accountId),
        draft: { projectId: id, name, discardUnsynced },
        classify: classifyApiWrite,
        async write(signal) {
          scope.assertCurrent();
          const removed = await api.removeLocalProject(
            id,
            { discardUnsynced, expectedAccount, expectedDevice },
            { signal },
          );
          if (removed.projectId !== id || removed.presence !== "cloud-only")
            throw new SyntaxError("The local removal did not return a matching receipt.");
          return removed;
        },
        async reconcile(removed, signal) {
          await scope.waitForCurrent(signal);
          await Promise.all([
            client.cancelQueries({ queryKey: catalogKey, exact: true }),
            client.cancelQueries({ queryKey: syncKey, exact: true }),
          ]);
          await scope.waitForCurrent(signal);
          getCloudCopyDownloads(owner).localCopyRemoved(scope.key);
          client.getQueryCache().find({ queryKey: syncKey, exact: true })?.reset();
          client.setQueryData<CloudProjectCatalog>(
            catalogKey,
            (before) =>
              before && {
                ...before,
                projects: before.projects.map((entry) =>
                  entry.id === id
                    ? {
                        ...entry,
                        presence: removed.presence,
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
          scope.assertCurrent();
          const catalog = await api.projectsCatalog({ signal, accountId: scope.accountId, expectedDevice });
          signal.throwIfAborted();
          scope.assertCurrent();
          if (
            catalog.account?.accountId !== expectedAccount.accountId ||
            catalog.account?.managerOrigin !== expectedAccount.managerOrigin
          )
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
