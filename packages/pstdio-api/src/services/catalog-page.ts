import type { PageQuery } from "pstdio-api-contracts";
import { pageBoundary, pageLimit, queryPage } from "pstdio-db";
/** Catalog metadata already belongs to the in-memory registry; hydrate only this page. */
export const catalogPage = <T extends { id: string }>(catalog: readonly T[], scope: string, input: PageQuery = {}) => {
  const boundary = pageBoundary(input.cursor, scope);
  const candidates = catalog
    .filter((item) => !boundary || item.id > boundary)
    .sort((a, b) => (a.id < b.id ? -1 : Number(a.id > b.id)));
  const page = queryPage(candidates.slice(0, pageLimit(input) + 1), pageLimit(input), scope);
  return { items: page.rows, nextCursor: page.nextCursor };
};
