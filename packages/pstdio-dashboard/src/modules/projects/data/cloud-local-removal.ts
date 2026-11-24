import type { ProjectCopyAccount, RemoveLocalProjectResult } from "@pstdio/sdk/client";
import { classifyApiWrite, getWorkbenchOperations } from "@pstdio/workbench";
import { useSyncExternalStore } from "react";
import { getRuntimeApiClient } from "@/lib/api";
import { getDashboardScopedQueries } from "@/lib/scoped-queries";
import { createRuntimeState } from "@/lib/sync/runtime-state";
import { dashboardCommandIds } from "@/shared/app/commands";
import { cloudProjectCopySubject } from "./cloud-copy-download";

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
    preflight: (id: string, signal: AbortSignal) => api.projectLocalRemoval(id, { signal }),
    async remove(id: string, name: string, expectedAccount: ProjectCopyAccount, discardUnsynced: boolean) {
      const { accountId, accountOrigin } = queries.getScope();
      if (accountId !== expectedAccount.accountId || accountOrigin !== expectedAccount.managerOrigin)
        throw new Error("The active Cloud account changed. Reopen this action to confirm again.");
      if (active(id)) throw new Error("This project already has a pending Cloud change.");
      return operations.submit<RemoveLocalProjectResult>({
        domain: "project.remove-device-copy",
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
