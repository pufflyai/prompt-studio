import { isDeepStrictEqual } from "node:util";
import { boardDefaultSyncRow, type PageQuery } from "pstdio-api-contracts";
import { type BoardViewsDeps, type ResolvedBoard, resolveBoardFields } from "./resolve-board";
import { cleanBoardView } from "./view-cleanup";

type ViewRow = Awaited<ReturnType<BoardViewsDeps["boardViewsService"]["list"]>>[number];
export const createBoardViewReader = (deps: BoardViewsDeps, emitView: (row: ViewRow) => void) => {
  const db = deps.boardViewsService;
  const savedView = (board: ResolvedBoard, row: Awaited<ReturnType<typeof db.list>>[number]) => ({
    id: row.id,
    boardId: board.id,
    title: row.title,
    settings: row.settings,
    filter: row.filter,
    sorts: row.sorts.slice(0, 1),
    builtIn: false,
  });
  const summary = async (board: ResolvedBoard) => ({
    id: board.id,
    title: board.title,
    kind: board.kind,
    extensionId: board.extensionId,
    fields: await resolveBoardFields(deps, board),
  });
  const initializeResolved = async (board: ResolvedBoard) => {
    const declaredDefault = board.body.defaultActiveViewId;
    const defaultIndex = Math.max(
      0,
      board.startingViews.findIndex((view) => view.id === declaredDefault),
    );
    const initialized = await db.initialize(board.scope, board.startingViews, defaultIndex);
    for (const row of initialized) emitView(row);
    if (initialized.length) {
      const initial = initialized[defaultIndex];
      deps.eventBus.emit(
        "board_default_views",
        "set",
        boardDefaultSyncRow({
          ...board.scope,
          default_view_id: initial.id,
          updated_at: initial.updated_at,
        }),
      );
    }
  };
  const cleanResolvedRows = async (board: ResolvedBoard, rows: Awaited<ReturnType<typeof db.list>>) => {
    // A failed extension query, or a table that cannot describe its columns yet, is never
    // evidence that a saved field disappeared.
    const fields = await resolveBoardFields(deps, board).catch(() => undefined);
    const cleanedRows = await Promise.all(
      rows.map(async (row) => {
        if (!row) return null;
        const cleaned = cleanBoardView(board, row, fields);
        if (isDeepStrictEqual(cleaned, { settings: row.settings, filter: row.filter, sorts: row.sorts })) return row;
        const updated = await db.clean(row, cleaned);
        if (updated) emitView(updated);
        return updated ?? (await db.get(board.scope.project_id, row.id));
      }),
    );
    return cleanedRows.filter((row) => row !== null);
  };
  const listResolved = async (board: ResolvedBoard) => {
    await initializeResolved(board);
    const rows = await cleanResolvedRows(board, await db.list(board.scope));
    const views = rows.map((row) => savedView(board, row));
    const chosen = (await db.getDefault(board.scope))?.default_view_id;
    const defaultViewId = [chosen, views[0].id].find((id) => views.some((view) => view.id === id))!;
    return { views, defaultViewId };
  };
  const queryResolved = async (board: ResolvedBoard, input: PageQuery) => {
    await initializeResolved(board);
    const page = await db.query(board.scope, input);
    const rows = await cleanResolvedRows(board, page.rows);
    return { items: rows.map((row) => savedView(board, row)), nextCursor: page.nextCursor };
  };

  return { savedView, summary, listResolved, queryResolved };
};
