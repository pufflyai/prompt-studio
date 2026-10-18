import { and, asc, eq, gt, isNull } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { workspaces } from "../../db/schemas.pg";
import { workspaceColumns } from "../legacy-resource-links";
import { type PageQuery, pageBoundary, pageLimit, queryPage } from "../query-page";
export const createWorkspaceQuery =
  (db: DbClient) =>
  async (projectId: string, input: PageQuery = {}) => {
    const scope = `workspaces:${projectId}`;
    const limit = pageLimit(input);
    const boundary = pageBoundary(input.cursor, scope);
    const rows = await db
      .select(workspaceColumns)
      .from(workspaces)
      .where(
        and(
          eq(workspaces.project_id, projectId),
          eq(workspaces.archived, false),
          isNull(workspaces.deleted_at),
          boundary ? gt(workspaces.id, boundary) : undefined,
        ),
      )
      .orderBy(asc(workspaces.id))
      .limit(limit + 1);
    return queryPage(rows, limit, scope);
  };
