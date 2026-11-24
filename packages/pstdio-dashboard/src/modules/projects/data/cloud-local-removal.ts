import type { ProjectCopyAccount, ProjectCopyDevice, RemoveLocalProjectResult } from "@pstdio/sdk/client";
import { classifyApiWrite, getWorkbenchOperations } from "@pstdio/workbench";
import { useSyncExternalStore } from "react";
import { getRuntimeApiClient } from "@/lib/api";
import { getDashboardScopedQueries } from "@/lib/scoped-queries";
import { createRuntimeState } from "@/lib/sync/runtime-state";
import { cloudProjectCopySubject } from "./cloud-copy-download";
import { cloudCopySourceCommand, requireProjectCopyScope } from "./project-copy-scope";

const getCloudLocalRemoval = createRuntimeState((owner) => {
  const queries = getDashboardScopedQueries(owner);
  const operations = getWorkbenchOperations(queries);
  const api = getRuntimeApiClient(owner).account;
  const active = (id: string) =>
    operations.getSnapshot().pending.some((entry) => entry.subjects.includes(cloudProjectCopySubject(id)));
  return {
    active,
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
      if (active(id)) throw new Error("This project already has a pending Cloud change.");
      return operations.submit<RemoveLocalProjectResult>({
        domain: "project.remove-device-copy",
        subjects: [cloudProjectCopySubject(id)],
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
        reconcile(_removed, signal) {
          signal.throwIfAborted();
          scope.assertCurrent();
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
