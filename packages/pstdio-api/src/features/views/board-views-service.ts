import { isDeepStrictEqual } from "node:util";
import {
  type BoardViewCreate,
  type BoardViewUpdate,
  boardDefaultSyncRow,
  EMPTY_VIEW_FILTER,
} from "pstdio-api-contracts";
import { type BoardViewsDeps, getBoards, type ResolvedBoard, requireBoard, resolveBoardFields } from "./resolve-board";
import { cleanBoardView } from "./view-cleanup";
import { BoardViewError, validateBoardView } from "./view-rules";

export const createBoardViewsService = (deps: BoardViewsDeps) => {
  const db = deps.boardViewsService;
  const emitView = (row: NonNullable<Awaited<ReturnType<typeof db.get>>>, op: "set" | "delete" = "set") =>
    deps.eventBus.emit("board_views", op, row);
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
  const listResolved = async (board: ResolvedBoard) => {
    let rows: (Awaited<ReturnType<typeof db.list>>[number] | null)[] = await db.list(board.scope);
    // A failed extension query, or a table that cannot describe its columns yet, is never
    // evidence that a saved field disappeared.
    const fields = await resolveBoardFields(deps, board).catch(() => undefined);
    rows = await Promise.all(
      rows.map(async (row) => {
        if (!row) return null;
        const cleaned = cleanBoardView(board, row, fields);
        if (isDeepStrictEqual(cleaned, { settings: row.settings, filter: row.filter, sorts: row.sorts })) return row;
        const updated = await db.clean(row, cleaned);
        if (updated) emitView(updated);
        return updated ?? (await db.get(board.scope.project_id, row.id));
      }),
    );
    const views = [...board.builtIns, ...rows.filter((row) => row !== null).map((row) => savedView(board, row))];
    const chosen = (await db.getDefault(board.scope))?.default_view_id;
    const flagged = board.kind === "kanban" ? board.body.defaultViews?.find((view) => view.isDefault)?.id : undefined;
    const defaultViewId = [chosen, board.body.defaultActiveViewId, flagged, views[0].id].find((id) =>
      views.some((view) => view.id === id),
    )!;
    return { views, defaultViewId };
  };
  const getSaved = async (projectId: string, id: string, allowOrphan = false) => {
    const boards = await getBoards(deps, projectId);
    const row = await db.get(projectId, id);
    if (!row) {
      if (boards.some((board) => board.builtIns.some((view) => view.id === id)))
        throw new BoardViewError("Built-in views are read-only; duplicate the view to edit it", 409);
      throw new BoardViewError("View not found", 404);
    }
    const snapshot = await deps.extensionRuntimeCatalog.get(projectId);
    if (!snapshot.enabledSources.some((source) => source.instance.id === row.extension_instance_id))
      throw new BoardViewError("board is not enabled", 404);
    const board = boards.find(
      (board) =>
        board.scope.extension_instance_id === row.extension_instance_id && board.scope.board_id === row.board_id,
    );
    if (!board && !allowOrphan) throw new BoardViewError("board is not enabled", 404);
    return { row, board };
  };
  return {
    board: async (projectId: string, boardId: string) => summary(await requireBoard(deps, projectId, boardId)),
    get: async (projectId: string, id: string) => {
      const { row, board } = await getSaved(projectId, id);
      const view = (await listResolved(board!)).views.find((view) => view.id === row.id);
      if (!view) throw new BoardViewError("View not found", 404);
      return view;
    },
    boards: async (projectId: string) => Promise.all((await getBoards(deps, projectId)).map(summary)),
    list: async (projectId: string, boardId: string) => listResolved(await requireBoard(deps, projectId, boardId)),
    orphaned: async (projectId: string) => {
      const boards = await getBoards(deps, projectId);
      const snapshot = await deps.extensionRuntimeCatalog.get(projectId);
      return (await db.listProject(projectId)).flatMap((row) => {
        const source = snapshot.enabledSources.find((source) => source.instance.id === row.extension_instance_id);
        if (
          !source ||
          boards.some(
            (board) =>
              board.scope.extension_instance_id === row.extension_instance_id && board.scope.board_id === row.board_id,
          )
        )
          return [];
        return [
          {
            id: row.id,
            boardId: `${source.installedSource.extension_id}.view.${row.board_id}`,
            title: row.title,
            settings: row.settings,
            filter: row.filter,
            sorts: row.sorts.slice(0, 1),
            builtIn: false,
          },
        ];
      });
    },
    create: async (projectId: string, boardId: string, input: BoardViewCreate) => {
      const board = await requireBoard(deps, projectId, boardId);
      const source = input.copyFrom
        ? (await listResolved(board)).views.find((view) => view.id === input.copyFrom)
        : undefined;
      if (input.copyFrom && !source) throw new BoardViewError("View to copy was not found", 404);
      const draft = {
        settings: { ...(source?.settings ?? board.settings), ...input.settings },
        filter: input.filter ?? source?.filter ?? board.body.defaultFilter ?? EMPTY_VIEW_FILTER,
        sorts: input.sorts ?? source?.sorts ?? board.body.defaultSorts ?? [],
      };
      const state = validateBoardView(board.kind, draft, await resolveBoardFields(deps, board), input);
      const row = await db.create({ ...board.scope, title: input.title, ...state });
      emitView(row);
      return savedView(board, row);
    },
    update: async (projectId: string, id: string, input: BoardViewUpdate) => {
      const { row, board } = await getSaved(projectId, id);
      const draft = {
        settings: { ...row.settings, ...input.settings },
        filter: input.filter ?? row.filter,
        sorts: input.sorts ?? row.sorts,
      };
      const state = validateBoardView(board!.kind, draft, await resolveBoardFields(deps, board!), input);
      const updated = await db.update(projectId, id, {
        ...state,
        ...(input.title === undefined ? {} : { title: input.title }),
      });
      if (!updated) throw new BoardViewError("View not found", 404);
      emitView(updated);
      return savedView(board!, updated);
    },
    remove: async (projectId: string, id: string) => {
      await getSaved(projectId, id, true);
      const removed = await db.remove(projectId, id);
      if (removed) {
        emitView(removed.view, "delete");
        if (removed.defaultView)
          deps.eventBus.emit("board_default_views", "delete", boardDefaultSyncRow(removed.defaultView));
      }
      return { deleted: true };
    },
    reorder: async (projectId: string, boardId: string, ids: string[]) => {
      const board = await requireBoard(deps, projectId, boardId);
      try {
        for (const row of await db.reorder(board.scope, ids)) emitView(row);
      } catch (error) {
        if (error instanceof Error && error.message.includes("every saved view"))
          throw new BoardViewError(error.message);
        throw error;
      }
      return listResolved(board);
    },
    setDefault: async (projectId: string, boardId: string, id: string | null) => {
      const board = await requireBoard(deps, projectId, boardId);
      const current = await listResolved(board);
      if (id !== null && !current.views.some((view) => view.id === id))
        throw new BoardViewError(`View not found. Valid IDs: ${current.views.map((view) => view.id).join(", ")}`);
      const row = await db.setDefault(board.scope, id);
      if (row) deps.eventBus.emit("board_default_views", id === null ? "delete" : "set", boardDefaultSyncRow(row));
      return listResolved(board);
    },
  };
};
