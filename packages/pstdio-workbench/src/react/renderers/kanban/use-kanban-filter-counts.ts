import type { CollectionPage, CollectionPageRequest } from "@pstdio/sdk/extensions";
import type { KanbanRendererQueryState, WorkbenchCore } from "../../../core";
import { rendererResourceDependency } from "../../../core/registries/renderers/renderer-refresh-key";
import { rendererQueryKey } from "../renderer-query-key";
import { useRendererRead } from "../use-renderer-read";
import { isPlannerTicketsBoard } from "./kanban-move";
import type { ReactRegisteredKanbanRendererContribution } from "./kanban-presentation";

export const useKanbanFilterCounts = (
  workbench: WorkbenchCore,
  contribution: ReactRegisteredKanbanRendererContribution,
  ownerKey: string,
  state: KanbanRendererQueryState,
  request: CollectionPageRequest,
  page: CollectionPage | undefined,
) => {
  const { id, queryScope, queryEvents, executePage } = contribution;
  const read = useRendererRead<CollectionPage>({
    workbench,
    ownerKey: `${ownerKey}:filter-counts`,
    sourceId: `${id}:filter-counts`,
    queryScope,
    queryEvents,
    dependency: rendererResourceDependency(state.resource),
    queryKey: rendererQueryKey([id, state.resource]),
    refreshKey: rendererQueryKey([state.filter, request.search, page?.revision]),
    enabled: Boolean(page && !page.statistics && executePage && isPlannerTicketsBoard(id)),
    load: async (signal) =>
      (
        await executePage!(
          { ...state, page: { ...request, limit: 0, offset: 0, cursor: undefined, revision: undefined, fields: [] } },
          signal,
        )
      ).page,
  });
  const statistics = read.acceptedValue?.revision === page?.revision ? read.acceptedValue?.statistics : undefined;
  return page && statistics ? { ...page, statistics } : page;
};
