import type { CollectionPageRequest } from "@pstdio/sdk/extensions";

/**
 * A continuation belongs to the revision of the page it continues. Once the data has changed,
 * for example through sync, the provider rejects it. Load the restart position on the current
 * data instead: the same page for page navigation, the first page for a growing list.
 */
export const loadRendererPage = async <T>(
  request: CollectionPageRequest,
  load: (request: CollectionPageRequest) => Promise<T>,
  restartOffset = request.offset,
) => {
  try {
    return { value: await load(request), request };
  } catch (error) {
    if (request.revision === undefined && request.cursor === undefined) throw error;
    const restarted = { ...request, offset: restartOffset, cursor: undefined, revision: undefined };
    return { value: await load(restarted), request: restarted };
  }
};
