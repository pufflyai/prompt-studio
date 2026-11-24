import type { CloudProjectDeletion, DeviceLogin, ProjectCopyAccount, ProjectCopyDevice } from "@pstdio/sdk/client";
import { classifyApiWrite, getWorkbenchOperations } from "@pstdio/workbench";
import { useSyncExternalStore } from "react";
import { getRuntimeApiClient } from "@/lib/api";
import { getDashboardQueryClient } from "@/lib/query-client";
import { getDashboardScopedQueries } from "@/lib/scoped-queries";
import { createRuntimeState } from "@/lib/sync/runtime-state";

import { cloudProjectCopySubject } from "./cloud-copy-download";
import { cloudCopySourceCommand, requireProjectCopyScope } from "./project-copy-scope";

export const cloudProjectDeletionKey = (id: string, account?: ProjectCopyAccount, login?: DeviceLogin) =>
  ["project-cloud-deletion", login?.managerOrigin, login?.accountId, login?.deviceId, account?.accountId, id] as const;

const accountChanged = "The active Cloud account changed. Reopen this action to confirm again.";

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
  const read = async (
    id: string,
    expected: ProjectCopyAccount | undefined,
    expectedDevice: ProjectCopyDevice | undefined,
    signal: AbortSignal,
  ) => {
    if (!expected) throw new Error(accountChanged);
    const scope = requireProjectCopyScope(owner, id, expected, expectedDevice, accountChanged);
    const receipt = await api.projectDeletionStatus(id, { signal, expected, expectedDevice });
    signal.throwIfAborted();
    scope.assertCurrent();
    return confirmedReceipt(id, receipt);
  };
  const active = (id: string) =>
    operations.getSnapshot().pending.find((entry) => entry.domain === domain && entry.intent === id);
  return {
    active,
    snapshot: operations.getSnapshot,
    subscribe: operations.subscribe,
    discard: operations.discard,
    check: operations.check,
    read,
    async start(id: string, name: string, expectedAccount: ProjectCopyAccount, expectedDevice: ProjectCopyDevice) {
      const scope = requireProjectCopyScope(owner, id, expectedAccount, expectedDevice, accountChanged);
      const subject = cloudProjectCopySubject(id);
      if (operations.getSnapshot().pending.some((entry) => entry.subjects.includes(subject)))
        throw new Error("This project already has a pending Cloud change.");
      return operations.submit({
        domain,
        subjects: [subject],
        title: `Delete cloud project “${name}”`,
        sourceCommand: cloudCopySourceCommand(scope.accountId),
        draft: { projectId: id, name },
        intent: id,
        classify: classifyApiWrite,
        releaseOnDiscard: true,
        async write(signal) {
          scope.assertCurrent();
          return confirmedReceipt(
            id,
            await api.deleteCloudProject(id, { confirm: true, expectedAccount, expectedDevice }, { signal }),
          );
        },
        reconcile(receipt, signal) {
          signal.throwIfAborted();
          scope.assertCurrent();
          const key = cloudProjectDeletionKey(id, expectedAccount, scope.login);
          client.setQueryData(key, (previous: typeof receipt | undefined) =>
            previous?.state === "completed" ? previous : receipt,
          );
        },
        async check(signal) {
          scope.assertCurrent();
          const result = await read(id, expectedAccount, expectedDevice, signal);
          scope.assertCurrent();
          return { status: "confirmed", result };
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
