import { and, desc, eq, inArray, isNotNull, or, sql } from "drizzle-orm";
import type { WorkspaceQuery } from "pstdio-api-contracts";
import type { ExtensionSessionQuery } from "pstdio-api-contracts/extension-kernel";
import type { StorageOwner } from "pstdio-sync";
import type { DbClient } from "../../db/connection.pglite";
import { storage_personal_history as history } from "../../db/schemas.pg";
import { pageBoundary, pageLimit, queryPage } from "../query-page";
import { decodeSessionQueryCursor } from "../sessions/session-query";
import { sessionAnchorCondition, workspaceAnchorCondition } from "../sessions/workspace-anchor-query";

import { personalAnchorCondition, personalWorkspaceSessionCondition } from "./personal-history-anchor-query";

type Login = { accountId: string; deviceId: string };
type Row = Record<string, unknown> & {
  id: string;
  created_at: string;
  updated_at: string;
  last_request_started?: string | null;
  last_request_ended?: string | null;
};
const field = (name: string) => sql<string>`${history.value}->>${name}`;
const activity = sql<string>`greatest(${field("created_at")}, ${field("updated_at")}, ${field("last_request_started")}, ${field("last_request_ended")})`;
const order = (input: ExtensionSessionQuery) => {
  if (input.orderBy === "lastActivity") return activity;
  return field(input.orderBy === "updated" ? "updated_at" : "created_at");
};
const ownerWhere = (owner: StorageOwner, login: Login, kind: string) =>
  and(
    eq(history.workbench_id, owner.workbenchId),
    eq(history.extension_id, owner.extensionId),
    eq(history.kind, kind),
    isNotNull(history.value),
    sql`${history.value}->'device'->>'ownerId' = ${login.accountId}`,
    sql`${history.value}->'device'->>'id' <> ${login.deviceId}`,
    sql`${field("project_id")} = ${owner.workbenchId}`,
  );

const sessionConditions = (owner: StorageOwner, login: Login, input: ExtensionSessionQuery) => {
  const conditions = [ownerWhere(owner, login, "sessions")];
  if (!input.includeArchived) conditions.push(sql`coalesce(${field("archived")}, 'false') = 'false'`);
  if (input.status) conditions.push(inArray(field("status"), input.status));
  if (input.agent) conditions.push(sql`${field("agent")} = ${input.agent}`);
  if (input.search) conditions.push(sql`position(lower(${input.search}) in lower(${field("title")})) > 0`);
  if (input.createdFrom) conditions.push(sql`${field("created_at")} >= ${new Date(input.createdFrom).toISOString()}`);
  if (input.createdTo) conditions.push(sql`${field("created_at")} <= ${new Date(input.createdTo).toISOString()}`);
  if (input.updatedFrom) conditions.push(sql`${field("updated_at")} >= ${new Date(input.updatedFrom).toISOString()}`);
  if (input.workspaceId)
    conditions.push(sql`exists (select 1 from storage_personal_history links where
    links.workbench_id = ${owner.workbenchId} and links.extension_id = ${owner.extensionId} and links.kind = 'workspace_sessions'
    and links.value->'device'->>'ownerId' = ${login.accountId} and links.value->'device'->>'id' <> ${login.deviceId}
    and links.value->>'workspace_id' = ${input.workspaceId} and links.value->>'session_id' = ${field("id")})`);
  if (input.anchor)
    conditions.push(
      or(
        personalAnchorCondition(owner.workbenchId, input.anchor, sql`${history.value}`),
        input.includeWorkspaceAnchors
          ? or(
              sessionAnchorCondition(owner.workbenchId, input.anchor, field("id")),
              personalWorkspaceSessionCondition(owner, login, input.anchor, field("id")),
            )
          : undefined,
      ),
    );
  return conditions;
};

export const queryPersonalSessions = async (
  db: DbClient,
  owner: StorageOwner,
  login: Login,
  input: ExtensionSessionQuery = {},
  options: { unpaged?: boolean } = {},
) => {
  const conditions = sessionConditions(owner, login, input);
  const cursor = input.cursor ? decodeSessionQueryCursor(input.cursor, owner.workbenchId, input.orderBy) : null;
  if (cursor) conditions.push(sql`(${order(input)}, ${field("id")}) < (${cursor.timestamp}, ${cursor.id})`);
  const value = input.workspaceId
    ? sql`${history.value} || jsonb_build_object('workspace_id', ${input.workspaceId}::text)`
    : history.value;
  const query = db
    .select({ value: sql<Row>`${value}` })
    .from(history)
    .where(and(...conditions))
    .orderBy(desc(order(input)), desc(field("id")))
    .$dynamic();
  const result = await (options.unpaged ? query : query.limit(pageLimit(input) + 1));
  const more = !options.unpaged && result.length > pageLimit(input);
  const rows = (more ? result.slice(0, pageLimit(input)) : result).map(({ value }) => value);
  const last = rows.at(-1);
  const activityAt = (row: Row) =>
    [row.created_at, row.updated_at, row.last_request_started ?? "", row.last_request_ended ?? ""].sort().at(-1)!;
  return {
    rows,
    nextCursor:
      more && last
        ? Buffer.from(
            JSON.stringify({
              projectId: owner.workbenchId,
              id: last.id,
              ...(input.orderBy ? { orderBy: input.orderBy } : {}),
              ...{
                created: { createdAt: last.created_at },
                updated: { updatedAt: last.updated_at },
                lastActivity: { activityAt: activityAt(last) },
              }[input.orderBy ?? "created"],
            }),
          ).toString("base64url")
        : null,
  };
};

export const queryPersonalWorkspaces = async (
  db: DbClient,
  owner: StorageOwner,
  login: Login,
  input: WorkspaceQuery & { shorthand?: string; includeArchived?: boolean } = {},
) => {
  const scope = `workspaces:${owner.workbenchId}`;
  const after = pageBoundary(input.cursor, scope);
  const rows = await db
    .select({ value: sql<Row>`${history.value}` })
    .from(history)
    .where(
      and(
        ownerWhere(owner, login, "workspaces"),
        input.includeArchived ? undefined : sql`coalesce(${field("archived")}, 'false') = 'false'`,
        sql`${field("deleted_at")} is null`,
        after ? sql`${field("id")} > ${after}` : undefined,
        input.anchors !== undefined
          ? (or(
              ...input.anchors.map((anchor) =>
                or(
                  personalAnchorCondition(owner.workbenchId, anchor, sql`${history.value}`),
                  workspaceAnchorCondition(owner.workbenchId, anchor, sql`select ${field("id")}`),
                ),
              ),
            ) ?? sql`false`)
          : undefined,
        input.shorthand ? sql`${field("workspace_shorthand")} = ${input.shorthand}` : undefined,
      ),
    )
    .orderBy(field("id"))
    .limit(pageLimit(input) + 1);
  return queryPage(
    rows.map(({ value }) => value),
    pageLimit(input),
    scope,
  );
};
