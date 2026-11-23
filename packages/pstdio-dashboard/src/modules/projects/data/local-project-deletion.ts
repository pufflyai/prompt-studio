import { PstdioApiError } from "@pstdio/sdk/client";
import {
  classifyApiWrite,
  getWorkbenchOperations,
  operationSubject,
  type WorkbenchOperations,
} from "@pstdio/workbench";
import { useSyncExternalStore } from "react";
import { getRuntimeApiClient } from "@/lib/api";
import { getDashboardScopedQueries } from "@/lib/scoped-queries";
import { createRuntimeState } from "@/lib/sync/runtime-state";
import { dashboardCommandIds } from "@/shared/app/commands";

const domain = "project.delete-local";

export const createLocalProjectDeletion = (
  operations: WorkbenchOperations,
  input: {
    remove(id: string): Promise<unknown>;
    read(id: string, signal: AbortSignal): Promise<unknown>;
    accept(id: string): void;
  },
) => {
  const deleting = (id: string) =>
    operations.getSnapshot().pending.find((entry) => entry.domain === domain && entry.intent === id);
  const hidden = (id: string) => {
    const status = deleting(id)?.status;
    return status === "queued" || status === "writing";
  };
  return {
    deleting,
    hidden,
    subscribe: operations.subscribe,
    snapshot: operations.getSnapshot,
    async remove(id: string, name?: string) {
      if (deleting(id)) throw new Error("This project already has a pending deletion. Check System activity.");
      return operations.submit<void>({
        // The project row can disappear before the response. Keep the receipt under the runtime authority.
        domain,
        subjects: [operationSubject("local-project", id)],
        title: name ? `Delete ${name}` : "Delete project",
        sourceCommand: { id: dashboardCommandIds.openProjects },
        intent: id,
        draft: { projectId: id, name },
        releaseOnDiscard: true,
        classify: classifyApiWrite,
        async write(signal) {
          signal.throwIfAborted();
          await input.remove(id);
        },
        reconcile(_result, signal) {
          signal.throwIfAborted();
          input.accept(id);
        },
        async check(signal) {
          try {
            await input.read(id, signal);
          } catch (error) {
            if (error instanceof PstdioApiError && error.status === 404)
              return { status: "confirmed", result: undefined };
            throw error;
          }
          return { status: "unknown" };
        },
      }).result;
    },
  };
};

export const getLocalProjectDeletion = createRuntimeState((owner) => {
  const api = getRuntimeApiClient(owner).projects;
  return createLocalProjectDeletion(getWorkbenchOperations(getDashboardScopedQueries(owner)), {
    remove: api.delete,
    read: (id, signal) => api.get(id, { signal }),
    accept: (id) => owner.getWriter("projects")?.remove(id),
  });
});

export const useLocalProjectDeletion = () => {
  const deletion = getLocalProjectDeletion();
  useSyncExternalStore(deletion.subscribe, deletion.snapshot, deletion.snapshot);
  return deletion;
};
