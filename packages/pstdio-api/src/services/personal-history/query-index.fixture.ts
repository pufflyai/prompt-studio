import type { ExtensionSessionQuery } from "pstdio-api-contracts/extension-kernel";
import { type PersonalIndexDelta, pageBoundary, pageLimit, queryPage } from "pstdio-db";
import type { StorageOwner } from "pstdio-sync";
import type { PersonalHistoryInput } from "./store";

type Index = PersonalHistoryInput["index"];
type Row = Awaited<ReturnType<Index["querySessions"]>>["rows"][number];

const sessionCursor = (owner: StorageOwner, input: ExtensionSessionQuery) => {
  let cursor: { id: string; timestamp: string } | undefined;
  if (input.cursor) {
    try {
      const value = JSON.parse(Buffer.from(input.cursor, "base64url").toString());
      const timestamp = { created: value.createdAt, updated: value.updatedAt, lastActivity: value.activityAt }[
        input.orderBy ?? "created"
      ];
      if (
        value.projectId === owner.workbenchId &&
        (value.orderBy ?? "created") === (input.orderBy ?? "created") &&
        typeof value.id === "string" &&
        Number.isFinite(Date.parse(timestamp))
      )
        cursor = { id: value.id, timestamp };
    } catch {
      /* Invalid cursors restart. */
    }
  }
  return cursor;
};

const matchesMetadata = (row: Row, input: ExtensionSessionQuery) => {
  if (!input.includeArchived && row.archived) return false;
  if (input.status && !input.status.includes(row.status as never)) return false;
  if (input.agent && row.agent !== input.agent) return false;
  if (input.search && !String(row.title).toLowerCase().includes(input.search.toLowerCase())) return false;
  if (input.createdFrom && row.created_at < new Date(input.createdFrom).toISOString()) return false;
  if (input.createdTo && row.created_at > new Date(input.createdTo).toISOString()) return false;
  if (input.updatedFrom && row.updated_at < new Date(input.updatedFrom).toISOString()) return false;
  return true;
};

const matchesAnchor = (row: Row, input: ExtensionSessionQuery) => {
  if (!input.anchor) return true;
  return (row.anchors_json as { type: string; id: string; extensionId?: string }[]).some(
    (anchor) =>
      anchor.type === input.anchor!.type &&
      anchor.id === input.anchor!.id &&
      (!input.anchor!.extensionId || anchor.extensionId === input.anchor!.extensionId) &&
      (!input.anchor!.projectId || row.project_id === input.anchor!.projectId),
  );
};

export const memoryHistoryQueries = (records: (owner: StorageOwner) => PersonalIndexDelta[]) => {
  const remote = (owner: StorageOwner, login: { accountId: string; deviceId: string }, kind: string) =>
    records(owner)
      .filter((row) => row.kind === kind && row.value !== null)
      .map((row) => row.value as Row)
      .filter((row) => {
        const device = row.device as { ownerId: string; id: string };
        return (
          device.ownerId === login.accountId && device.id !== login.deviceId && row.project_id === owner.workbenchId
        );
      });
  const querySessions: Index["querySessions"] = async (owner, login, input = {}, options = {}) => {
    const timeOf = (row: Row) => {
      if (input.orderBy === "updated") return row.updated_at;
      if (input.orderBy === "lastActivity")
        return [row.created_at, row.updated_at, row.last_request_started ?? "", row.last_request_ended ?? ""]
          .sort()
          .at(-1)!;
      return row.created_at;
    };
    const cursor = sessionCursor(owner, input);
    const links = records(owner)
      .filter((row) => row.kind === "workspace_sessions")
      .map((row) => row.value as Record<string, unknown>);
    const rows = remote(owner, login, "sessions")
      .filter((row) => {
        if (!matchesMetadata(row, input)) return false;
        if (
          input.workspaceId &&
          !links.some((link) => link.workspace_id === input.workspaceId && link.session_id === row.id)
        )
          return false;
        if (
          !matchesAnchor(row, input) &&
          !(
            input.includeWorkspaceAnchors &&
            links.some(
              (link) =>
                link.session_id === row.id &&
                remote(owner, login, "workspaces").some(
                  (workspace) =>
                    workspace.id === link.workspace_id &&
                    !workspace.archived &&
                    !workspace.deleted_at &&
                    matchesAnchor(workspace, input),
                ),
            )
          )
        )
          return false;
        return !cursor || timeOf(row) < cursor.timestamp || (timeOf(row) === cursor.timestamp && row.id < cursor.id);
      })
      .sort((a, b) => timeOf(b).localeCompare(timeOf(a)) || b.id.localeCompare(a.id));
    const more = !options.unpaged && rows.length > pageLimit(input);
    const items = (more ? rows.slice(0, pageLimit(input)) : rows).map((row) =>
      input.workspaceId ? { ...row, workspace_id: input.workspaceId } : row,
    );
    const last = items.at(-1);
    return {
      rows: items,
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
                  lastActivity: { activityAt: timeOf(last) },
                }[input.orderBy ?? "created"],
              }),
            ).toString("base64url")
          : null,
    };
  };
  const queryWorkspaces: Index["queryWorkspaces"] = async (owner, login, input = {}) => {
    const scope = `workspaces:${owner.workbenchId}`;
    const cursor = pageBoundary(input.cursor, scope);
    const rows = remote(owner, login, "workspaces")
      .filter(
        (row) =>
          !row.deleted_at &&
          (input.anchors === undefined || input.anchors.some((anchor) => matchesAnchor(row, { anchor }))) &&
          (input.includeArchived || !row.archived) &&
          (!input.shorthand || row.workspace_shorthand === input.shorthand) &&
          (!cursor || row.id > cursor),
      )
      .sort((a, b) => a.id.localeCompare(b.id));
    return queryPage(rows, pageLimit(input), scope);
  };
  return { querySessions, queryWorkspaces };
};
