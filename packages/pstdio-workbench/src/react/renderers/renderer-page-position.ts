import type { CollectionPage } from "@pstdio/sdk/extensions";

/** A cursor belongs to its accepted page, even while navigation is loading another position. */
export const rendererPagePosition = (
  identity: string,
  offset: number,
  limit: number,
  accepted: { offset: number; page: Pick<CollectionPage, "revision" | "cursor"> },
) => ({
  identity,
  offset,
  revision: accepted.page.revision,
  cursor: offset === accepted.offset + limit ? (accepted.page.cursor ?? undefined) : undefined,
});
