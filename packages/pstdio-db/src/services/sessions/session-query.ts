import { and, desc, eq, exists, gte, inArray, lt, lte, or, sql } from "drizzle-orm";
import { sessionStatusSchema } from "pstdio-api-contracts";
import type { ExtensionSessionQuery } from "pstdio-api-contracts/extension-kernel";
import type { DbClient } from "../../db/connection.pglite";
import { resource_anchors, sessions, workspace_sessions } from "../../db/schemas.pg";
import { historyAnchorProjection, sessionColumns } from "../legacy-resource-links";
import { sessionAnchorCondition, workspaceAnchorCondition } from "./workspace-anchor-query";

const activityTime = sql<string>`greatest(${sessions.last_request_ended}, ${sessions.last_request_started}, ${sessions.updated_at}, ${sessions.created_at})`;
const queryOrder = (input: ExtensionSessionQuery) => {
  if (input.orderBy === "lastActivity") return activityTime;
  if (input.orderBy === "updated") return sql<string>`${sessions.updated_at}`;
  return sql<string>`${sessions.created_at}`;
};

export const decodeSessionQueryCursor = (
  value: string,
  projectId: string,
  orderBy: ExtensionSessionQuery["orderBy"],
) => {
  try {
    const cursor = JSON.parse(Buffer.from(value, "base64url").toString());
    const timestamp = { created: cursor.createdAt, lastActivity: cursor.activityAt, updated: cursor.updatedAt }[
      orderBy ?? "created"
    ];
    if (
      cursor?.projectId === projectId &&
      (cursor.orderBy ?? "created") === (orderBy ?? "created") &&
      typeof timestamp === "string" &&
      Number.isFinite(Date.parse(timestamp)) &&
      typeof cursor.id === "string" &&
      cursor.id.length > 0
    ) {
      return { timestamp, id: cursor.id as string };
    }
  } catch {
    /* Invalid cursors restart at the first page. */
  }
  return null;
};

const statusCondition = (statuses: NonNullable<ExtensionSessionQuery["status"]>) => {
  for (const status of statuses) {
    if (!sessionStatusSchema.safeParse(status).success) throw new Error(`Invalid session status: ${status}`);
  }
  return inArray(sessions.status, statuses);
};

const queryConditions = (db: DbClient, projectId: string, input: ExtensionSessionQuery) => {
  const conditions = [eq(sessions.project_id, projectId)];
  if (!input.includeArchived) conditions.push(eq(sessions.archived, false));
  if (input.status) {
    conditions.push(statusCondition(input.status));
  }
  if (input.agent) conditions.push(eq(sessions.agent, input.agent));
  if (input.search) conditions.push(sql`position(lower(${input.search}) in lower(${sessions.title})) > 0`);
  if (input.createdFrom) conditions.push(gte(sessions.created_at, new Date(input.createdFrom).toISOString()));
  if (input.createdTo) conditions.push(lte(sessions.created_at, new Date(input.createdTo).toISOString()));
  if (input.updatedFrom) conditions.push(gte(sessions.updated_at, new Date(input.updatedFrom).toISOString()));
  if (input.workspaceId) {
    conditions.push(
      exists(
        db
          .select({ id: workspace_sessions.id })
          .from(workspace_sessions)
          .where(
            and(eq(workspace_sessions.session_id, sessions.id), eq(workspace_sessions.workspace_id, input.workspaceId)),
          ),
      ),
    );
  }
  if (input.anchor) {
    conditions.push(
      or(
        exists(
          db
            .select({ id: resource_anchors.source_id })
            .from(resource_anchors)
            .where(
              and(
                eq(resource_anchors.project_id, projectId),
                eq(resource_anchors.source_owner, "pstdio"),
                eq(resource_anchors.source_kind, "session"),
                eq(resource_anchors.source_id, sessions.id),
                eq(resource_anchors.target_kind, input.anchor.type),
                eq(resource_anchors.target_id, input.anchor.id),
                input.anchor.extensionId ? eq(resource_anchors.target_owner, input.anchor.extensionId) : undefined,
                input.anchor.projectId ? eq(resource_anchors.project_id, input.anchor.projectId) : undefined,
              ),
            ),
        ),
        input.includeWorkspaceAnchors
          ? or(
              sessionAnchorCondition(projectId, input.anchor, sql`${sessions.id}`),
              workspaceAnchorCondition(
                projectId,
                input.anchor,
                sql`select ws.workspace_id from workspace_sessions ws join workspaces w on w.id = ws.workspace_id
                  where ws.session_id = ${sessions.id} and w.project_id = ${projectId} and w.archived = false and w.deleted_at is null`,
              ),
            )
          : undefined,
      )!,
    );
  }
  const cursor = input.cursor ? decodeSessionQueryCursor(input.cursor, projectId, input.orderBy) : null;
  if (cursor)
    conditions.push(
      or(
        lt(queryOrder(input), cursor.timestamp),
        and(eq(queryOrder(input), cursor.timestamp), lt(sessions.id, cursor.id)),
      )!,
    );

  return conditions;
};

export const createSessionQuery =
  (db: DbClient) =>
  async (
    projectId: string,
    input: ExtensionSessionQuery = {},
    options: { unpaged?: boolean; includeIncomingAnchors?: boolean } = {},
  ) => {
    const conditions = queryConditions(db, projectId, input);
    const limit = Number.isFinite(input.limit) ? Math.max(1, Math.min(200, Math.trunc(input.limit!))) : 50;
    // A scalar projection avoids duplicate sessions when several workspaces are linked.
    const workspaceId = sql<string | null>`(select ws.workspace_id from workspace_sessions ws
    join workspaces w on w.id = ws.workspace_id and w.project_id = "sessions"."project_id"
    where ws.session_id = "sessions"."id"
    ${input.workspaceId ? sql`and ws.workspace_id = ${input.workspaceId}` : sql``}
    order by ws.created_at, ws.id limit 1)`.as("workspace_id");
    const query = db
      .select({
        ...sessionColumns,
        ...(options.includeIncomingAnchors ? { anchors_json: historyAnchorProjection(sessions, "session") } : {}),
        workspace_id: workspaceId,
        activity_at: activityTime.as("activity_at"),
      })
      .from(sessions)
      .where(and(...conditions))
      .orderBy(desc(queryOrder(input)), desc(sessions.id))
      .$dynamic();
    const result = await (options.unpaged ? query : query.limit(limit + 1));
    const hasMore = !options.unpaged && result.length > limit;
    const rows = hasMore ? result.slice(0, limit) : result;
    const last = rows.at(-1);
    const nextCursor =
      hasMore && last
        ? Buffer.from(
            JSON.stringify({
              projectId,
              id: last.id,
              ...(input.orderBy ? { orderBy: input.orderBy } : {}),
              ...{
                created: { createdAt: last.created_at },
                lastActivity: { activityAt: last.activity_at },
                updated: { updatedAt: last.updated_at },
              }[input.orderBy ?? "created"],
            }),
          ).toString("base64url")
        : null;
    return { rows, nextCursor };
  };
