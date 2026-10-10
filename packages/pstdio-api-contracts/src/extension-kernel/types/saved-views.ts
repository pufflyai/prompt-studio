import type { BoardView, BoardViewCreate, BoardViews, BoardViewUpdate } from "../../board-views";
import type { ViewRef } from "./contribution-identity";

export type { BoardView, BoardViewCreate, BoardViews, BoardViewUpdate } from "../../board-views";

/** Project saved views of native boards and tables, shared with the dashboard and CLI. */
export interface ExtensionViewsApi {
  list(board: ViewRef): Promise<BoardViews>;
  create(board: ViewRef, input: BoardViewCreate): Promise<BoardView>;
  update(board: ViewRef, id: string, input: BoardViewUpdate): Promise<BoardView>;
  remove(board: ViewRef, id: string): Promise<{ deleted: boolean }>;
  reorder(board: ViewRef, ids: string[]): Promise<BoardViews>;
  setDefault(board: ViewRef, id: string | null): Promise<BoardViews>;
}
