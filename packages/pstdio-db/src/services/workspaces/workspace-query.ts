import { and, asc, eq, gt, isNull, or, sql } from "drizzle-orm";
import type { WorkspaceQuery } from "pstdio-api-contracts";
import type { DbClient } from "../../db/connection.pglite";
import { workspaces } from "../../db/schemas.pg";
import { workspaceColumns } from "../legacy-resource-links";
import { pageBoundary, pageLimit, queryPage } from "../query-page";
import { workspaceAnchorCondition } from "../sessions/workspace-anchor-query";
export const createWorkspaceQuery =
  (db: DbClient) =>
  async (projectId: string, input: WorkspaceQuery = {}) => {
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
          input.anchors !== undefined
            ? (or(
                ...input.anchors.map((anchor) =>
                  workspaceAnchorCondition(projectId, anchor, sql`select ${workspaces.id}`),
                ),
              ) ?? sql`false`)
            : undefined,
          isNull(workspaces.deleted_at),
          boundary ? gt(workspaces.id, boundary) : undefined,
        ),
      )
      .orderBy(asc(workspaces.id))
      .limit(limit + 1);
    return queryPage(rows, limit, scope);
  };
