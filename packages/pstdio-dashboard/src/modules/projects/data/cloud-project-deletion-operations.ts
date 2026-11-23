import type { CloudProjectDeletion, ProjectCopyAccount } from "@pstdio/sdk/client";
import { classifyApiWrite, getWorkbenchOperations, operationSubject } from "@pstdio/workbench";
import { useSyncExternalStore } from "react";
import { getRuntimeApiClient } from "@/lib/api";
import { getDashboardQueryClient } from "@/lib/query-client";
import { getDashboardScopedQueries } from "@/lib/scoped-queries";
import { createRuntimeState } from "@/lib/sync/runtime-state";
import { dashboardCommandIds } from "@/shared/app/commands";

export const cloudProjectDeletionKey = (id: string, account?: ProjectCopyAccount) =>
  ["project-cloud-deletion", account?.managerOrigin, account?.accountId, id] as const;

const confirmedReceipt = (id: string, receipt: CloudProjectDeletion) => {
  if (receipt.projectId !== id) throw new SyntaxError("The project deletion receipt does not match the request.");
  return receipt;
};

const getCloudProjectDeletions = createRuntimeState((owner) => {
  const queries = getDashboardScopedQueries(owner);
  const operations = getWorkbenchOperations(queries);
  const client = getDashboardQueryClient(owner);
  const api = getRuntimeApiClient(owner).account;
  const domain = "project.cloud-delete";
  const read = async (id: string, expected: ProjectCopyAccount | undefined, signal: AbortSignal) =>
    confirmedReceipt(id, await api.projectDeletionStatus(id, { signal, expected }));
  const active = (id: string) =>
    operations.getSnapshot().pending.find((entry) => entry.domain === domain && entry.intent === id);
  return {
    active,
    snapshot: operations.getSnapshot,
    subscribe: operations.subscribe,
    discard: operations.discard,
    check: operations.check,
    read,
    async start(id: string, name: string, expectedAccount: ProjectCopyAccount) {
      const { accountId, accountOrigin } = queries.getScope();
      if (accountId !== expectedAccount.accountId || accountOrigin !== expectedAccount.managerOrigin)
        throw new Error("The active Cloud account changed. Reopen this action to confirm again.");
      if (active(id)) throw new Error("This project's Cloud deletion is already in progress.");
      return operations.submit({
        domain,
        subjects: [operationSubject("cloud-project-deletion", id)],
        title: `Delete cloud project “${name}”`,
        sourceCommand: { id: dashboardCommandIds.openProjects },
        draft: { projectId: id, name },
        intent: id,
        classify: classifyApiWrite,
        releaseOnDiscard: true,
        write: async (signal) =>
          confirmedReceipt(id, await api.deleteCloudProject(id, { confirm: true, expectedAccount }, { signal })),
        reconcile(receipt, signal) {
          signal.throwIfAborted();
          const key = cloudProjectDeletionKey(id, expectedAccount);
          client.setQueryData(key, (previous: typeof receipt | undefined) =>
            previous?.state === "completed" ? previous : receipt,
          );
        },
        async check(signal) {
          return { status: "confirmed", result: await read(id, expectedAccount, signal) };
        },
      }).result;
    },
  };
});

export const useCloudProjectDeletions = () => {
  const operations = getCloudProjectDeletions();
  useSyncExternalStore(operations.subscribe, operations.snapshot, operations.snapshot);
  return operations;
};
