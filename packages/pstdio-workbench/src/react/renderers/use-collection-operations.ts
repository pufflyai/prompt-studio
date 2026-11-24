import {
  CommandOutcomeError,
  type KanbanRendererMove,
  type QueryDependency,
  type QueryScope,
} from "@pstdio/sdk/extensions";
import { useEffect, useSyncExternalStore } from "react";
import type { WorkbenchCore } from "../../core";
import { classifyApiWrite } from "../../core/registries/mutations/operation-failures";
import { getWorkbenchOperations } from "../../core/registries/mutations/operations";
import { getRendererReadCache } from "../../core/registries/views/renderer-read-registry";
import { getWorkbenchQueries } from "../../core/workbench-queries";
import { collectionOperation, collectionReadMatches } from "./collection-operation-projection";

interface CollectionRead {
  sourceId: string;
  queryKey: string;
  refreshKey?: string;
  queryScope?: Partial<QueryScope>;
  dependency?: QueryDependency;
}

const reportedHandlerFailure = (error: unknown) =>
  error instanceof CommandOutcomeError && error.outcome.status === "error" && error.code === "handler_threw";

export const collectionReadIdentity = (read: CollectionRead) => ({
  ...read,
  queryKey: JSON.stringify([read.queryKey, read.refreshKey]),
});

const observedRead = (workbench: WorkbenchCore, read: CollectionRead) => {
  const identity = collectionReadIdentity(read);
  return {
    key: JSON.stringify([identity.queryScope, identity.sourceId, identity.queryKey]),
    refresh: (signal: AbortSignal) => {
      signal.throwIfAborted();
      return getRendererReadCache(workbench.views.reads).refreshObserved(identity);
    },
  };
};

export const useCollectionOperations = (
  workbench: WorkbenchCore,
  read: CollectionRead,
  rows: readonly { id: string; resource?: unknown }[],
) => {
  const operations = getWorkbenchOperations(getWorkbenchQueries(workbench));
  const { pending } = useSyncExternalStore(operations.subscribe, operations.getSnapshot, operations.getSnapshot);
  const projectId = read.queryScope?.projectId;
  useEffect(
    () =>
      operations.observeRead({
        ...observedRead(workbench, read),
        matches: (operation) => collectionReadMatches(operation, rows, read.sourceId, projectId),
      }),
    [operations, projectId, read, rows, workbench],
  );
  return {
    pending,
    originatingRead: observedRead(workbench, read),
    submit: async (
      move: KanbanRendererMove,
      write: () => void | Promise<void>,
      options?: { refreshAfterHandlerFailure: boolean },
    ) => {
      const origin = observedRead(workbench, read);
      const failedHandler = (error: unknown) => options?.refreshAfterHandlerFailure && reportedHandlerFailure(error);
      return operations.submit({
        ...collectionOperation({
          sourceId: read.sourceId,
          projectId,
          row: rows.find(({ id }) => id === move.rowId),
          move,
        }),
        classify: (error) => (failedHandler(error) ? "rejected" : classifyApiWrite(error)),
        write,
        reconcileRejection: options?.refreshAfterHandlerFailure
          ? (error, signal) => {
              // Read the saved fields even if the source panel has closed. The handler may have changed them.
              if (reportedHandlerFailure(error))
                return getRendererReadCache(workbench.views.reads).refreshRequired(
                  collectionReadIdentity(read),
                  signal,
                );
            }
          : undefined,
        originatingRead: origin,
      }).result;
    },
  };
};
