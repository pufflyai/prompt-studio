import { and, eq, isNull, sql } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { board_views, preferences } from "../../db/schemas.pg";

export type BoardScope = Pick<typeof board_views.$inferSelect, "project_id" | "extension_id" | "board_id">;
export type BoardDefault = BoardScope & { default_view_id: string; updated_at: string };
type Client = Pick<DbClient, "select" | "insert" | "update" | "delete">;
export const boardScopeWhere = (scope: BoardScope) =>
  and(
    eq(board_views.project_id, scope.project_id),
    scope.extension_id === null ? isNull(board_views.extension_id) : eq(board_views.extension_id, scope.extension_id),
    eq(board_views.board_id, scope.board_id),
  );
const preferenceKey = (scope: BoardScope) =>
  `board-default:${scope.extension_id === null ? "native" : "extension"}:${scope.board_id}`;
const preferenceWhere = (scope: BoardScope) =>
  and(
    eq(preferences.scope, "project"),
    eq(preferences.scope_id, scope.project_id),
    eq(preferences.project_id, scope.project_id),
    eq(preferences.extension_id, scope.extension_id ?? ""),
    eq(preferences.key, preferenceKey(scope)),
  );
const fromView = (row: typeof board_views.$inferSelect): BoardDefault => ({
  project_id: row.project_id,
  extension_id: row.extension_id,
  board_id: row.board_id,
  default_view_id: row.id,
  updated_at: row.updated_at,
});
const preferenceScope = (row: typeof preferences.$inferSelect): BoardScope => ({
  project_id: row.project_id!,
  extension_id: row.key.startsWith("board-default:native:") ? null : row.extension_id,
  board_id: row.key.slice(
    row.key.startsWith("board-default:native:") ? "board-default:native:".length : "board-default:extension:".length,
  ),
});
const scopeKey = (scope: BoardScope) => JSON.stringify([scope.project_id, scope.extension_id, scope.board_id]);
type SelectionMetadata = { builtin_view_id?: string };
export const getBoardDefault = async (db: Client, scope: BoardScope) => {
  const [metadata] = await db.select().from(preferences).where(preferenceWhere(scope));
  const [view] = await db
    .select()
    .from(board_views)
    .where(and(boardScopeWhere(scope), eq(board_views.is_default, true)));
  if (view) return { ...fromView(view), updated_at: metadata?.updated_at ?? view.updated_at };
  const id = (metadata?.value as SelectionMetadata | undefined)?.builtin_view_id;
  return id ? { ...scope, default_view_id: id, updated_at: metadata!.updated_at } : null;
};
export const listBoardDefaults = async (db: Client, projectId?: string, extensionId?: string) => {
  const views = await db
    .select()
    .from(board_views)
    .where(
      and(
        eq(board_views.is_default, true),
        projectId ? eq(board_views.project_id, projectId) : undefined,
        extensionId ? eq(board_views.extension_id, extensionId) : undefined,
      ),
    );
  const metadata = await db
    .select()
    .from(preferences)
    .where(
      and(
        eq(preferences.scope, "project"),
        sql`starts_with(${preferences.key}, 'board-default:')`,
        projectId ? eq(preferences.project_id, projectId) : undefined,
        extensionId ? eq(preferences.extension_id, extensionId) : undefined,
      ),
    );
  const timestamps = new Map(metadata.map((row) => [scopeKey(preferenceScope(row)), row.updated_at]));
  return [
    ...views.map((view) => ({ ...fromView(view), updated_at: timestamps.get(scopeKey(view)) ?? view.updated_at })),
    ...metadata.flatMap((row) => {
      const id = (row.value as SelectionMetadata).builtin_view_id;
      return id ? [{ ...preferenceScope(row), default_view_id: id, updated_at: row.updated_at }] : [];
    }),
  ];
};
// Built-in selections and the independent selection timestamp are preferences.
// Saved views also carry the flag, enforcing one default per board in the index.
export const setBoardDefault = async (
  db: Client,
  scope: BoardScope,
  id: string | null,
  stamp = new Date().toISOString(),
) => {
  const previous = await getBoardDefault(db, scope);
  await db
    .update(board_views)
    .set({ is_default: false })
    .where(and(boardScopeWhere(scope), eq(board_views.is_default, true)));
  await db.delete(preferences).where(preferenceWhere(scope));
  if (id === null) return previous;
  const [saved] = await db
    .update(board_views)
    .set({ is_default: true })
    .where(and(boardScopeWhere(scope), eq(board_views.id, id)))
    .returning({ id: board_views.id });
  const owner = { scope: "project" as const, scope_id: scope.project_id, extension_id: scope.extension_id ?? "" };
  const row: BoardDefault = { ...scope, default_view_id: id, updated_at: stamp };
  await db.insert(preferences).values({
    ...owner,
    project_id: scope.project_id,
    key: preferenceKey(scope),
    sync: "team",
    value: saved ? {} : { builtin_view_id: id },
    updated_at: stamp,
  });
  return row;
};
