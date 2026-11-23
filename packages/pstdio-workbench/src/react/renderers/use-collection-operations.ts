import type { KanbanRendererMove, QueryDependency, QueryScope } from "@pstdio/sdk/extensions";
import { useEffect, useSyncExternalStore } from "react";
import type { WorkbenchCore } from "../../core";
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

const observedRead = (workbench: WorkbenchCore, read: CollectionRead) => {
  const identity = { ...read, queryKey: JSON.stringify([read.queryKey, read.refreshKey]) };
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
    submit: async (move: KanbanRendererMove, write: () => void | Promise<void>) =>
      operations.submit({
        ...collectionOperation({
          sourceId: read.sourceId,
          projectId,
          row: rows.find(({ id }) => id === move.rowId),
          move,
        }),
        write,
        originatingRead: observedRead(workbench, read),
      }).result,
  };
};
