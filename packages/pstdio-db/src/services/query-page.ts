import type { PageQuery } from "pstdio-api-contracts";

export type { PageQuery } from "pstdio-api-contracts";

export const pageLimit = (input: PageQuery) =>
  Number.isFinite(input.limit) ? Math.max(1, Math.min(200, Math.trunc(input.limit!))) : 50;

export const pageBoundary = (cursor: string | undefined, scope: string) => {
  if (!cursor) return null;
  try {
    const value = JSON.parse(Buffer.from(cursor, "base64url").toString());
    if (value.scope === scope && typeof value.id === "string" && value.id.length) return value.id as string;
  } catch {
    // Malformed or foreign cursors restart the collection, matching session queries.
  }
  return null;
};

export const queryPage = <T extends { id: string }>(rows: T[], limit: number, scope: string) => {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items.at(-1);
  const nextCursor = hasMore && last ? Buffer.from(JSON.stringify({ scope, id: last.id })).toString("base64url") : null;
  return { rows: items, nextCursor };
};
