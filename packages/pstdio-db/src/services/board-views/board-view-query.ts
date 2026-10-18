import { and, asc, eq, gt, isNull, or } from "drizzle-orm";
import type { PageQuery } from "pstdio-api-contracts";
import type { DbClient } from "../../db/connection.pglite";
import { board_views } from "../../db/schemas.pg";
import { pageLimit } from "../query-page";

type Scope = Pick<typeof board_views.$inferSelect, "project_id" | "extension_instance_id" | "board_id">;
const decodeCursor = (cursor: string | undefined, scope: string) => {
  try {
    const value = JSON.parse(Buffer.from(cursor ?? "", "base64url").toString());
    if (
      value.scope === scope &&
      typeof value.id === "string" &&
      value.id.length &&
      Number.isInteger(value.sortOrder) &&
      value.sortOrder >= -2147483648 &&
      value.sortOrder <= 2147483647 &&
      typeof value.createdAt === "string" &&
      Number.isFinite(Date.parse(value.createdAt))
    ) {
      return value as { id: string; sortOrder: number; createdAt: string };
    }
  } catch {
    /* Invalid cursors restart at the first page. */
  }
  return null;
};

export const queryBoardViews = async (db: DbClient, scope: Scope, input: PageQuery = {}) => {
  const scopeKey = JSON.stringify([scope.project_id, scope.extension_instance_id, scope.board_id]);
  const boundary = decodeCursor(input.cursor, scopeKey);
  const limit = pageLimit(input);
  const result = await db
    .select()
    .from(board_views)
    .where(
      and(
        eq(board_views.project_id, scope.project_id),
        eq(board_views.board_id, scope.board_id),
        scope.extension_instance_id === null
          ? isNull(board_views.extension_instance_id)
          : eq(board_views.extension_instance_id, scope.extension_instance_id),
        boundary
          ? or(
              gt(board_views.sort_order, boundary.sortOrder),
              and(eq(board_views.sort_order, boundary.sortOrder), gt(board_views.created_at, boundary.createdAt)),
              and(
                eq(board_views.sort_order, boundary.sortOrder),
                eq(board_views.created_at, boundary.createdAt),
                gt(board_views.id, boundary.id),
              ),
            )
          : undefined,
      ),
    )
    .orderBy(asc(board_views.sort_order), asc(board_views.created_at), asc(board_views.id))
    .limit(limit + 1);
  const hasMore = result.length > limit;
  const rows = hasMore ? result.slice(0, limit) : result;
  const last = rows.at(-1);
  const nextCursor =
    hasMore && last
      ? Buffer.from(
          JSON.stringify({ scope: scopeKey, id: last.id, sortOrder: last.sort_order, createdAt: last.created_at }),
        ).toString("base64url")
      : null;
  return { rows, nextCursor };
};
