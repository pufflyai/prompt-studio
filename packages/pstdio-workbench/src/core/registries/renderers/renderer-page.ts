import type { CollectionPage, CollectionPageRequest } from "@pstdio/sdk/extensions";

export class RendererPageRevisionChanged extends Error {
  constructor() {
    super("The query revision changed. Reload the first page.");
  }
}

export const acceptRendererPage = <TRow>(
  result: { rows: TRow[]; page?: CollectionPage },
  request: CollectionPageRequest,
) => {
  const page = result.page;
  if (!page || typeof page.revision !== "string" || !Array.isArray(page.groups))
    throw new Error("A paged provider must return page metadata");
  if (request.revision !== undefined && request.revision !== page.revision) throw new RendererPageRevisionChanged();
  if (result.rows.length > request.limit) throw new Error("The provider exceeded the requested page limit");
  if (
    !Number.isSafeInteger(page.total) ||
    !Number.isSafeInteger(page.filteredTotal) ||
    page.filteredTotal < 0 ||
    result.rows.length > page.filteredTotal ||
    page.total < page.filteredTotal ||
    page.groups.some((group) => !Number.isSafeInteger(group.count) || group.count < 0 || group.count > page.total)
  )
    throw new Error("The provider returned inconsistent page counts");
  if (page.cursor !== null && (typeof page.cursor !== "string" || !page.cursor))
    throw new Error("The provider must return a cursor or null");
  return { rows: result.rows, page };
};
