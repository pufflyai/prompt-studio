import type { WorkspaceQuery } from "pstdio-api-contracts";
import type { ExtensionSessionQuery } from "pstdio-api-contracts/extension-kernel";
import { pageLimit, queryPage } from "pstdio-db";
import type { RouteDeps } from "../../features/deps";

type SessionReads = Pick<RouteDeps, "sessionService" | "personalHistoryService">;
type WorkspaceReads = Pick<RouteDeps, "workspaceService" | "personalHistoryService">;
type SessionRow = Awaited<ReturnType<RouteDeps["personalHistoryService"]["sessions"]>>[number];
type TimedSession = Pick<SessionRow, "created_at" | "updated_at" | "last_request_started" | "last_request_ended">;
const activityAt = (row: TimedSession) =>
  [row.created_at, row.updated_at, row.last_request_started ?? "", row.last_request_ended ?? ""].sort().at(-1)!;
const timeOf = (row: TimedSession, input: ExtensionSessionQuery) => {
  if (input.orderBy === "lastActivity") return activityAt(row);
  if (input.orderBy === "updated") return row.updated_at;
  return row.created_at;
};

export const queryReadableSessions = async (
  deps: SessionReads,
  projectId: string,
  input: ExtensionSessionQuery = {},
  options: { unpaged?: boolean } = {},
) => {
  const [local, remote] = await Promise.all([
    deps.sessionService.query(projectId, input, options),
    deps.personalHistoryService.querySessions(projectId, input, options),
  ]);
  const limit = pageLimit(input);
  const rows = [...local.rows, ...remote.rows].sort((a, b) => {
    return timeOf(b, input).localeCompare(timeOf(a, input)) || b.id.localeCompare(a.id);
  });
  const more = !options.unpaged && (rows.length > limit || Boolean(local.nextCursor) || Boolean(remote.nextCursor));
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
              ...(input.orderBy ? { orderBy: input.orderBy } : {}),
              ...{
                created: { createdAt: last.created_at },
                lastActivity: { activityAt: activityAt(last) },
                updated: { updatedAt: last.updated_at },
              }[input.orderBy ?? "created"],
            }),
          ).toString("base64url")
        : null,
  };
};

export const readableWorkspaces = async (deps: WorkspaceReads, projectId: string) => [
  ...(await deps.workspaceService.list(projectId)),
  ...(await deps.personalHistoryService.workspaces(projectId)).filter((row) => !row.archived),
];
export const queryReadableWorkspaces = async (deps: WorkspaceReads, projectId: string, input: WorkspaceQuery = {}) => {
  const scope = `workspaces:${projectId}`;
  const [local, remote] = await Promise.all([
    deps.workspaceService.query(projectId, input),
    deps.personalHistoryService.queryWorkspaces(projectId, input),
  ]);
  const rows = [...local.rows, ...remote.rows].sort((a, b) => a.id.localeCompare(b.id));
  const page = queryPage(rows, pageLimit(input), scope);
  if (!page.nextCursor) page.nextCursor = local.nextCursor ?? remote.nextCursor;
  return page;
};
