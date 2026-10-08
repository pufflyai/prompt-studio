import { and, asc, eq, isNull, sql } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { board_default_views, board_views } from "../../db/schemas.pg";

type BoardScope = Pick<typeof board_views.$inferSelect, "project_id" | "extension_instance_id" | "board_id">;
type ViewInput = Pick<typeof board_views.$inferSelect, "title" | "settings" | "filter" | "sorts">;
type ViewsTransaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];
const scopeWhere = (table: typeof board_views | typeof board_default_views, scope: BoardScope) =>
  and(
    eq(table.project_id, scope.project_id),
    scope.extension_instance_id === null
      ? isNull(table.extension_instance_id)
      : eq(table.extension_instance_id, scope.extension_instance_id),
    eq(table.board_id, scope.board_id),
  );
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
  const get = async (projectId: string, id: string) =>
    (await db.select().from(board_views).where(viewWhere(projectId, id)))[0] ?? null;
  const getDefault = async (scope: BoardScope) =>
    (await db.select().from(board_default_views).where(scopeWhere(board_default_views, scope)))[0] ?? null;
  const initialize = (scope: BoardScope, views: ViewInput[], defaultIndex: number) =>
    db.transaction(async (tx) => {
      const existing = await tx.select().from(board_views).where(scopeWhere(board_views, scope));
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
      await tx
        .insert(board_default_views)
        .values({
          ...scope,
          default_view_id: rows[defaultIndex].id,
          updated_at: now,
        })
        .onConflictDoUpdate({
          target: [
            board_default_views.project_id,
            board_default_views.extension_instance_id,
            board_default_views.board_id,
          ],
          set: { default_view_id: rows[defaultIndex].id, updated_at: now },
        });
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
  const setDefault = async (scope: BoardScope, viewId: string | null) => {
    if (viewId === null)
      return (
        (await db.delete(board_default_views).where(scopeWhere(board_default_views, scope)).returning())[0] ?? null
      );
    const row = { ...scope, default_view_id: viewId, updated_at: new Date().toISOString() };
    return (
      await db
        .insert(board_default_views)
        .values(row)
        .onConflictDoUpdate({
          target: [
            board_default_views.project_id,
            board_default_views.extension_instance_id,
            board_default_views.board_id,
          ],
          set: { default_view_id: viewId, updated_at: row.updated_at },
        })
        .returning()
    )[0];
  };
  const deleteView = async (tx: ViewsTransaction, projectId: string, id: string) => {
    const [view] = await tx.delete(board_views).where(viewWhere(projectId, id)).returning();
    if (!view) return null;
    const [defaultView] = await tx
      .delete(board_default_views)
      .where(and(scopeWhere(board_default_views, view), eq(board_default_views.default_view_id, id)))
      .returning();
    return { view, defaultView: defaultView ?? null };
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
    listProject,
    get,
    getDefault,
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
