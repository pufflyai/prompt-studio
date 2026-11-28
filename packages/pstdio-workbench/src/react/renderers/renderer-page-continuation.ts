import type { CollectionPage, CollectionPageRequest } from "@pstdio/sdk/extensions";

/**
 * A continuation belongs to the revision of the page it continues. Once the data has changed,
 * for example through sync, the provider rejects it, so load the same position on the current
 * data. A provider error cannot say why it failed across the command boundary, so any failed
 * continuation is asked once more without its cursor and revision.
 */
export const loadRendererPage = async <T>(
  request: CollectionPageRequest,
  load: (request: CollectionPageRequest) => Promise<T>,
  signal: AbortSignal,
) => {
  try {
    return { value: await load(request), request };
  } catch (error) {
    if (signal.aborted || (request.revision === undefined && request.cursor === undefined)) throw error;
    const restarted = { ...request, cursor: undefined, revision: undefined };
    return { value: await load(restarted), request: restarted };
  }
};

/** Keep the rows the growing view already shows and skip duplicate IDs on a continuation. */
export const appendRendererRows = <TRow>(shown: TRow[], page: TRow[], rowId: (row: TRow) => string) => {
  const known = new Set(shown.map(rowId));
  return [...shown, ...page.filter((row) => !known.has(rowId(row)))];
};

const readRendererWindow = async <TRow, T extends { rows: TRow[]; page: CollectionPage }>(
  request: CollectionPageRequest,
  read: (request: CollectionPageRequest) => Promise<T>,
  signal: AbortSignal,
) => {
  const end = request.offset ?? 0;
  const rows: TRow[] = [];
  let revision: string | undefined;
  for (let offset = 0; offset < end; ) {
    const limit = Math.min(end - offset, Math.max(request.limit, 100));
    const result = await read({ ...request, offset, limit, cursor: undefined, revision });
    signal.throwIfAborted();
    rows.push(...result.rows);
    if (!result.page.cursor) return { ...result, rows };
    revision = result.page.revision;
    offset += limit;
  }
  // Keep the final cursor at the view's ordinary page size so scrolling can continue.
  const result = await read({ ...request, cursor: undefined, revision });
  signal.throwIfAborted();
  return { ...result, rows: [...rows, ...result.rows] };
};

/** Reconcile only the requested rows. A concurrent update can invalidate a pinned batch. */
export const refreshRendererWindow = async <TRow, T extends { rows: TRow[]; page: CollectionPage }>(
  request: CollectionPageRequest,
  read: (request: CollectionPageRequest) => Promise<T>,
  signal: AbortSignal,
) => {
  try {
    return await readRendererWindow<TRow, T>(request, read, signal);
  } catch (error) {
    if (signal.aborted || !(error instanceof Error) || !error.message.includes("revision is stale")) throw error;
    return readRendererWindow<TRow, T>(request, read, signal);
  }
};
