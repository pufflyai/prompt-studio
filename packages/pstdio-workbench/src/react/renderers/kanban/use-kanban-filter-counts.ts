import type { CollectionPage, CollectionPageRequest } from "@pstdio/sdk/extensions";
import type { KanbanRendererQueryState, RegisteredKanbanRendererContribution, WorkbenchCore } from "../../../core";
import { rendererResourceDependency } from "../../../core/registries/renderers/renderer-refresh-key";
import { rendererQueryKey } from "../renderer-query-key";
import { useRendererRead } from "../use-renderer-read";
import { isPlannerTicketsBoard } from "./kanban-move";

export const useKanbanFilterCounts = (
  workbench: WorkbenchCore,
  contribution: Pick<RegisteredKanbanRendererContribution, "id" | "queryScope" | "queryEvents" | "executePage">,
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
    // Unlike rows, counts for another query cannot be kept visible during replacement.
    queryKey: rendererQueryKey([
      id,
      state.resource,
      state.filter,
      state.settings.columnGrouping,
      state.settings.rowGrouping,
      request.search,
      request.search.trim() ? request.searchFields : undefined,
      request.presentation,
      request.collapsedGroups,
      page?.revision,
    ]),
    enabled: Boolean(page && !page.statistics && executePage && isPlannerTicketsBoard(id)),
    load: async (signal) =>
      (
        await executePage!(
          { ...state, page: { ...request, limit: 0, offset: 0, cursor: undefined, revision: undefined, fields: [] } },
          signal,
        )
      ).page,
  });
  if (!page || page.statistics || read.acceptedValue?.revision !== page.revision) return page;
  const { statistics } = read.acceptedValue;
  return statistics ? { ...page, statistics } : page;
};
