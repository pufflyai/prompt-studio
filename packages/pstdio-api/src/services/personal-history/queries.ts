import type { PageQuery } from "pstdio-api-contracts";
import type { ExtensionSessionQuery } from "pstdio-api-contracts/extension-kernel";
import { pageBoundary, pageLimit, queryPage } from "pstdio-db";
import type { RouteDeps } from "../../features/deps";

type SessionReads = Pick<RouteDeps, "sessionService" | "personalHistoryService">;
type WorkspaceReads = Pick<RouteDeps, "workspaceService" | "personalHistoryService">;
type SessionRow = Awaited<ReturnType<RouteDeps["personalHistoryService"]["sessions"]>>[number];
type TimedSession = Pick<SessionRow, "created_at" | "updated_at" | "last_request_started" | "last_request_ended">;
const activityAt = (row: TimedSession) =>
  [row.created_at, row.updated_at, row.last_request_started ?? "", row.last_request_ended ?? ""].sort().at(-1)!;
const timeOf = (row: TimedSession, input: ExtensionSessionQuery) =>
  input.orderBy === "lastActivity" ? activityAt(row) : row.created_at;

const boundary = (cursor: string | undefined, projectId: string, input: ExtensionSessionQuery) => {
  if (!cursor) return null;
  try {
    const value = JSON.parse(Buffer.from(cursor, "base64url").toString());
    const timestamp = input.orderBy === "lastActivity" ? value.activityAt : value.createdAt;
    if (
      value.projectId === projectId &&
      (value.orderBy ?? "created") === (input.orderBy ?? "created") &&
      typeof value.id === "string" &&
      value.id &&
      typeof timestamp === "string" &&
      Number.isFinite(Date.parse(timestamp))
    )
      return { id: value.id as string, timestamp: timestamp as string };
  } catch {
    /* Invalid cursors restart the collection, as in the local query. */
  }
  return null;
};
const matches = (row: SessionRow, input: ExtensionSessionQuery) => {
  if (!input.includeArchived && row.archived) return false;
  if (input.status && !input.status.includes(row.status)) return false;
  if (input.agent && row.agent !== input.agent) return false;
  if (input.workspaceId && row.workspace_id !== input.workspaceId) return false;
  if (input.createdFrom && row.created_at < new Date(input.createdFrom).toISOString()) return false;
  if (input.createdTo && row.created_at > new Date(input.createdTo).toISOString()) return false;
  if (input.updatedFrom && row.updated_at < new Date(input.updatedFrom).toISOString()) return false;
  if (
    input.anchor &&
    !row.anchors_json.some(
      (anchor) =>
        anchor.type === input.anchor!.type &&
        anchor.id === input.anchor!.id &&
        (!input.anchor!.extensionId || anchor.extensionId === input.anchor!.extensionId) &&
        (!input.anchor!.projectId || row.project_id === input.anchor!.projectId),
    )
  )
    return false;
  return true;
};

export const queryReadableSessions = async (
  deps: SessionReads,
  projectId: string,
  input: ExtensionSessionQuery = {},
  options: { unpaged?: boolean } = {},
) => {
  const local = await deps.sessionService.query(projectId, input, options);
  let remote = await deps.personalHistoryService.sessions(projectId);
  if (input.workspaceId) {
    const links = await deps.personalHistoryService.links(projectId);
    const ids = new Set(links.filter((link) => link.workspace_id === input.workspaceId).map((link) => link.session_id));
    remote = remote.filter((row) => ids.has(row.id)).map((row) => ({ ...row, workspace_id: input.workspaceId! }));
  }
  const limit = pageLimit(input);
  const cursor = boundary(input.cursor, projectId, input);
  const extra = remote.filter(
    (row) =>
      matches(row, input) &&
      (!cursor ||
        timeOf(row, input) < cursor.timestamp ||
        (timeOf(row, input) === cursor.timestamp && row.id < cursor.id)),
  );
  const rows = [...local.rows, ...extra].sort((a, b) => {
    return timeOf(b, input).localeCompare(timeOf(a, input)) || b.id.localeCompare(a.id);
  });
  const more = !options.unpaged && (rows.length > limit || Boolean(local.nextCursor));
  const items = options.unpaged ? rows : rows.slice(0, limit);
  const last = items.at(-1);
  return {
    rows: items,
    nextCursor:
      more && last
        ? Buffer.from(
            JSON.stringify({
              projectId,
              id: last.id,
              ...(input.orderBy === "lastActivity"
                ? {
                    orderBy: "lastActivity",
                    activityAt: activityAt(last),
                  }
                : { createdAt: last.created_at }),
            }),
          ).toString("base64url")
        : null,
  };
};

export const readableWorkspaces = async (deps: WorkspaceReads, projectId: string) => [
  ...(await deps.workspaceService.list(projectId)),
  ...(await deps.personalHistoryService.workspaces(projectId)).filter((row) => !row.archived),
];
export const queryReadableWorkspaces = async (deps: WorkspaceReads, projectId: string, input: PageQuery = {}) => {
  const scope = `workspaces:${projectId}`;
  const cursor = pageBoundary(input.cursor, scope);
  const local = await deps.workspaceService.query(projectId, input);
  const remote = (await deps.personalHistoryService.workspaces(projectId)).filter(
    (row) => !row.archived && (!cursor || row.id > cursor),
  );
  const rows = [...local.rows, ...remote].sort((a, b) => a.id.localeCompare(b.id));
  const page = queryPage(rows, pageLimit(input), scope);
  if (!page.nextCursor && local.nextCursor) page.nextCursor = local.nextCursor;
  return page;
};
