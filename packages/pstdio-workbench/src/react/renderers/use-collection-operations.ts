import {
  CommandOutcomeError,
  type KanbanRendererMove,
  type QueryDependency,
  type QueryScope,
} from "@pstdio/sdk/extensions";
import { useEffect, useSyncExternalStore } from "react";
import type { WorkbenchCore } from "../../core";
import { classifyApiWrite } from "../../core/registries/mutations/operation-failures";
import { recoveryStatus } from "../../core/registries/mutations/operation-state";
import { getWorkbenchOperations, operationSubject } from "../../core/registries/mutations/operations";
import { getRendererReadCache } from "../../core/registries/views/renderer-read-registry";
import { getWorkbenchQueries } from "../../core/workbench-queries";
import {
  type ArchiveColumnIntent,
  archiveColumnDomain,
  collectionOperation,
  collectionReadMatches,
} from "./collection-operation-projection";

interface CollectionRead {
  sourceId: string;
  queryKey: string;
  refreshKey?: string;
  projectionKey?: string;
  queryScope?: Partial<QueryScope>;
  dependency?: QueryDependency;
}

const reportedHandlerFailure = (error: unknown) =>
  error instanceof CommandOutcomeError && error.outcome.status === "error" && error.code === "handler_threw";

export const collectionReadIdentity = (read: CollectionRead) => ({
  ...read,
  queryKey: JSON.stringify([read.queryKey, read.refreshKey]),
});

const observedRead = <T>(workbench: WorkbenchCore, read: CollectionRead, projectUnobserved?: (value: T) => T) => {
  const identity = collectionReadIdentity(read);
  return {
    key: JSON.stringify([identity.queryScope, identity.sourceId, identity.queryKey]),
    refresh: (signal: AbortSignal) => {
      signal.throwIfAborted();
      return getRendererReadCache(workbench.views.reads).refreshObserved(identity, projectUnobserved);
    },
  };
};

export const useCollectionOperations = <T>(
  workbench: WorkbenchCore,
  read: CollectionRead,
  rows: readonly { id: string; resource?: unknown }[],
  projectUnobserved?: (value: T, move: KanbanRendererMove) => T,
) => {
  const operations = getWorkbenchOperations(getWorkbenchQueries(workbench));
  const { pending } = useSyncExternalStore(operations.subscribe, operations.getSnapshot, operations.getSnapshot);
  const projectId = read.queryScope?.projectId;
  const waitForPendingWrites = () =>
    operations.waitForPending((operation) => collectionReadMatches(operation, rows, read.sourceId, projectId));
  const projectSaved = (project: (value: T) => T) =>
    read.projectionKey
      ? async () => {
          await getRendererReadCache(workbench.views.reads).projectUnobserved(read.projectionKey!, project);
        }
      : undefined;
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
    isSaving: () =>
      pending.some(
        (operation) =>
          !recoveryStatus(operation.status) && collectionReadMatches(operation, rows, read.sourceId, projectId),
      ),
    waitForPendingWrites,
    archiveColumn: (intent: ArchiveColumnIntent, write: () => Promise<void>, project: (value: T) => T) => {
      const earlierWrites = waitForPendingWrites();
      void earlierWrites.catch(() => {});
      return operations.submit({
        domain: archiveColumnDomain,
        projectId,
        subjects: [operationSubject(archiveColumnDomain, projectId, read.sourceId, intent.columnId)],
        title: "Archive column",
        intent,
        classify: classifyApiWrite,
        originatingRead: observedRead(workbench, read, project),
        reconcile: projectSaved(project),
        async write() {
          await earlierWrites;
          await write();
        },
      }).result;
    },
    originatingRead: observedRead(workbench, read),
    submit: async (
      move: KanbanRendererMove,
      write: () => void | Promise<void>,
      options?: { refreshAfterHandlerFailure: boolean },
    ) => {
      const project = projectUnobserved && ((value: T) => projectUnobserved(value, move));
      const origin = observedRead<T>(workbench, read, project);
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
        reconcile: project && projectSaved(project),
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
