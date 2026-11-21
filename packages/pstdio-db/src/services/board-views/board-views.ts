import { and, asc, eq, gt, inArray, not, or, sql } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { board_views } from "../../db/schemas.pg";
import { type PageQuery, pageBoundary, pageLimit, queryPage } from "../query-page";
import {
  type BoardScope,
  boardScopeWhere,
  getBoardDefault,
  listBoardDefaults,
  setBoardDefault,
} from "./board-defaults";
import { queryBoardViews } from "./board-view-query";

type ViewInput = Pick<typeof board_views.$inferSelect, "title" | "settings" | "filter" | "sorts">;
type ViewsTransaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];
const scopeWhere = (_table: typeof board_views, scope: BoardScope) => boardScopeWhere(scope);
const viewWhere = (projectId: string, id: string) => and(eq(board_views.project_id, projectId), eq(board_views.id, id));

export class LastBoardViewError extends Error {
  constructor() {
    super("A board must keep at least one view");
  }
}

export const createBoardViewsDBService = (db: DbClient) => {
  const list = (scope: BoardScope) =>
    db
      .select()
      .from(board_views)
      .where(scopeWhere(board_views, scope))
      .orderBy(asc(board_views.sort_order), asc(board_views.created_at), asc(board_views.id));
  const listProject = (projectId: string) => db.select().from(board_views).where(eq(board_views.project_id, projectId));
  const queryOrphaned = async (
    projectId: string,
    input: PageQuery,
    enabledInstances: string[],
    boards: BoardScope[],
  ) => {
    const scope = `orphaned-views:${projectId}`;
    const boundary = pageBoundary(input.cursor, scope);
    const limit = pageLimit(input);
    const rows = await db
      .select()
      .from(board_views)
      .where(
        and(
          eq(board_views.project_id, projectId),
          enabledInstances.length ? inArray(board_views.extension_instance_id, enabledInstances) : sql`false`,
          boards.length ? not(or(...boards.map((board) => scopeWhere(board_views, board)))!) : undefined,
          boundary ? gt(board_views.id, boundary) : undefined,
        ),
      )
      .orderBy(asc(board_views.id))
      .limit(limit + 1);
    return queryPage(rows, limit, scope);
  };
  const get = async (projectId: string, id: string) =>
    (await db.select().from(board_views).where(viewWhere(projectId, id)))[0] ?? null;
  const getDefault = (scope: BoardScope) => getBoardDefault(db, scope);
  const initialize = (scope: BoardScope, views: ViewInput[], defaultIndex: number) =>
    db.transaction(async (tx) => {
      const existing = await tx
        .select({ id: board_views.id })
        .from(board_views)
        .where(scopeWhere(board_views, scope))
        .limit(1);
      if (existing.length) return [];
      const now = new Date().toISOString();
      const rows = await tx
        .insert(board_views)
        .values(
          views.map((view, sort_order) => ({
            ...scope,
            ...view,
            id: crypto.randomUUID(),
            sort_order,
            created_at: now,
            updated_at: now,
          })),
        )
        .returning();
      await setBoardDefault(tx, scope, rows[defaultIndex].id, now);
      return rows;
    });
  const create = async (input: BoardScope & ViewInput) => {
    const now = new Date().toISOString();
    return db.transaction(async (tx) => {
      const [order] = await tx
        .select({ last: sql<number>`coalesce(max(${board_views.sort_order}), -1)` })
        .from(board_views)
        .where(scopeWhere(board_views, input));
      const [row] = await tx
        .insert(board_views)
        .values({ ...input, id: crypto.randomUUID(), sort_order: order.last + 1, created_at: now, updated_at: now })
        .returning();
      return row;
    });
  };
  const update = async (projectId: string, id: string, input: Partial<ViewInput>) =>
    (
      await db
        .update(board_views)
        .set({ ...input, updated_at: new Date().toISOString() })
        .where(viewWhere(projectId, id))
        .returning()
    )[0] ?? null;
  const clean = async (original: typeof board_views.$inferSelect, input: Omit<ViewInput, "title">) =>
    (
      await db
        .update(board_views)
        .set({ ...input, updated_at: new Date().toISOString() })
        .where(
          and(
            viewWhere(original.project_id, original.id),
            eq(board_views.updated_at, original.updated_at),
            eq(board_views.settings, original.settings),
            eq(board_views.filter, original.filter),
            eq(board_views.sorts, original.sorts),
          ),
        )
        .returning()
    )[0] ?? null;
  const setDefault = (scope: BoardScope, id: string | null) => db.transaction((tx) => setBoardDefault(tx, scope, id));
  const deleteView = async (tx: ViewsTransaction, projectId: string, id: string) => {
    const [view] = await tx.select().from(board_views).where(viewWhere(projectId, id));
    if (!view) return null;
    const selected = await getBoardDefault(tx, view);
    const defaultView = selected?.default_view_id === id ? await setBoardDefault(tx, view, null) : null;
    await tx.delete(board_views).where(viewWhere(projectId, id));
    return { view, defaultView };
  };
  const removeOrphaned = (projectId: string, id: string) => db.transaction((tx) => deleteView(tx, projectId, id));
  const remove = (projectId: string, id: string) =>
    db.transaction(async (tx) => {
      const [current] = await tx.select().from(board_views).where(viewWhere(projectId, id));
      if (!current) return null;
      const remaining = await tx.select().from(board_views).where(scopeWhere(board_views, current));
      if (remaining.length === 1) throw new LastBoardViewError();
      return deleteView(tx, projectId, id);
    });
  const reorder = (scope: BoardScope, ids: string[]) =>
    db.transaction(async (tx) => {
      const rows = await tx.select().from(board_views).where(scopeWhere(board_views, scope));
      if (new Set(ids).size !== ids.length || ids.length !== rows.length || rows.some((row) => !ids.includes(row.id)))
        throw new Error("Order must contain every saved view exactly once");
      const updated = [];
      for (const [sort_order, id] of ids.entries()) {
        const [row] = await tx
          .update(board_views)
          .set({ sort_order, updated_at: new Date().toISOString() })
          .where(viewWhere(scope.project_id, id))
          .returning();
        updated.push(row);
      }
      return updated;
    });
  return {
    list,
    query: (scope: BoardScope, input?: PageQuery) => queryBoardViews(db, scope, input),
    listProject,
    queryOrphaned,
    get,
    getDefault,
    listDefaults: (projectId?: string) => listBoardDefaults(db, projectId),
    initialize,
    create,
    update,
    clean,
    setDefault,
    remove,
    removeOrphaned,
    reorder,
  };
};
