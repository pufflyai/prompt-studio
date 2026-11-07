import type { CollectionPageRequest } from "@pstdio/sdk/extensions";

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

/**
 * A growing list keeps the rows it already shows. A page loaded on newer data can repeat a row
 * that moved forward, so repeated rows are dropped; a row that moved back appears on the next refresh.
 */
export const appendRendererRows = <TRow>(shown: TRow[], page: TRow[], rowId: (row: TRow) => string) => {
  const known = new Set(shown.map(rowId));
  return [...shown, ...page.filter((row) => !known.has(rowId(row)))];
};
