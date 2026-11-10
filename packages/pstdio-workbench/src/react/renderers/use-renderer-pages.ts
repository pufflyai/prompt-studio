import type { CollectionPage, CollectionPageRequest } from "@pstdio/sdk/extensions";
import { useRef, useState } from "react";
import { appendRendererRows, loadRendererPage } from "./renderer-page-continuation";
import { rendererPagePosition } from "./renderer-page-position";
import { clampCollectionPageSize, defaultCollectionPageSize } from "./renderer-page-size";

interface PagePosition {
  identity: string;
  offset: number;
  cursor?: string;
  revision?: string;
}

/** Navigation owns only the requested position. Loaded rows still belong to the renderer read. */
export const useRendererPages = <TRow>(input: {
  identity: string;
  scope: string;
  fields: string[];
  /** A growing list, such as a board, appends each page to the rows it already shows. */
  rowId?: (row: TRow) => string;
  initialPageSize?: number;
}) => {
  const [search, setSearch] = useState("");
  const [collapse, setCollapse] = useState({ scope: input.scope, groups: [] as string[] });
  const collapsedGroups = collapse.scope === input.scope ? collapse.groups : [];
  const setCollapsedGroups = (groups: string[]) => setCollapse({ scope: input.scope, groups });
  const [limit, setLimit] = useState(clampCollectionPageSize(input.initialPageSize ?? defaultCollectionPageSize));
  const identity = JSON.stringify([input.identity, input.fields, search, collapsedGroups, limit]);
  const [position, setPosition] = useState<PagePosition>({ identity, offset: 0 });
  const current = position.identity === identity ? position : { identity, offset: 0 };
  if (position.identity !== identity) setPosition(current);
  const previous = useRef<{ identity: string; offset: number; rows: TRow[]; page: CollectionPage } | undefined>(
    undefined,
  );
  const request: CollectionPageRequest = {
    limit,
    offset: current.offset,
    cursor: current.offset ? current.cursor : undefined,
    revision: current.offset ? current.revision : undefined,
    fields: input.fields,
    search,
    collapsedGroups,
  };
  const reset = () => {
    previous.current = undefined;
    if (!current.offset) return false;
    setPosition({ identity, offset: 0 });
    return true;
  };
  const go = (index: number) => {
    const saved = previous.current;
    if (saved?.identity !== identity || (input.rowId && saved.offset !== current.offset)) return;
    setPosition(rendererPagePosition(identity, index * limit, limit, saved));
  };
  return {
    key: identity,
    request,
    // A restarted continuation drops its cursor and revision without asking for the page again.
    refreshKey: JSON.stringify([identity, current.offset]),
    search,
    setSearch,
    collapsedGroups,
    setCollapsedGroups,
    pageIndex: Math.floor(current.offset / limit),
    setLimit,
    reset,
    go,
    accept: (result: { rows: TRow[]; page?: CollectionPage; position?: CollectionPageRequest }) => {
      if (!result.page || !result.position) return;
      previous.current = { identity, offset: result.position.offset ?? 0, rows: result.rows, page: result.page };
      // Every presentation adopts a restarted continuation, including views that did not run the loader.
      if (current.cursor !== result.position.cursor || current.revision !== result.position.revision)
        setPosition({
          identity,
          offset: current.offset,
          cursor: result.position.cursor,
          revision: result.position.revision,
        });
    },
    controls: (
      result: CollectionPage | undefined,
      loading: boolean,
      enabled: boolean,
      displayed?: CollectionPageRequest,
    ) =>
      enabled
        ? {
            request,
            result,
            displayed,
            loading,
            onSearchChange: setSearch,
            onPageSizeChange: (size: number) => setLimit(clampCollectionPageSize(size)),
            onCollapsedGroupsChange: setCollapsedGroups,
            onPageChange: (index: number) => {
              if (result) go(index);
            },
            onLoadMore: () => {
              if (result?.cursor) go(Math.floor(current.offset / limit) + 1);
            },
          }
        : undefined,
    load: async <TResult extends { rows: TRow[]; page: CollectionPage }>(
      read: (request: CollectionPageRequest) => Promise<TResult>,
      signal: AbortSignal,
    ) => {
      const loaded = await loadRendererPage(request, read, signal);
      const result = loaded.value;
      const saved = previous.current;
      const rows =
        input.rowId && current.offset > 0 && saved?.identity === identity
          ? appendRendererRows(saved.rows.slice(0, current.offset), result.rows, input.rowId)
          : result.rows;
      return { ...result, rows, position: loaded.request };
    },
  };
};
