import type { BoardSummary, BoardView, BoardViewCreate, BoardViews, BoardViewUpdate } from "pstdio-api-contracts";
import type { RequestFn } from "./request";

const projectPath = (id: string) => `/v1/projects/${encodeURIComponent(id)}`;
const boardPath = (projectId: string, boardId: string) =>
  `${projectPath(projectId)}/boards/${encodeURIComponent(boardId)}/views`;
const viewPath = (projectId: string, id: string) => `${projectPath(projectId)}/board-views/${encodeURIComponent(id)}`;
export const createBoardViewsClient = (request: RequestFn) => ({
  board: (projectId: string, boardId: string) =>
    request<BoardSummary>(`${projectPath(projectId)}/boards/${encodeURIComponent(boardId)}`),
  get: (projectId: string, id: string) => request<BoardView>(viewPath(projectId, id)),
  boards: (projectId: string) => request<BoardSummary[]>(`${projectPath(projectId)}/boards`),
  list: (projectId: string, boardId: string) => request<BoardViews>(boardPath(projectId, boardId)),
  orphaned: (projectId: string) => request<BoardView[]>(`${projectPath(projectId)}/board-views?orphaned=true`),
  create: (projectId: string, boardId: string, input: BoardViewCreate) =>
    request<BoardView>(boardPath(projectId, boardId), { method: "POST", body: input }),
  update: (projectId: string, id: string, input: BoardViewUpdate) =>
    request<BoardView>(viewPath(projectId, id), { method: "PATCH", body: input }),
  delete: (projectId: string, id: string) =>
    request<{ deleted: boolean }>(viewPath(projectId, id), { method: "DELETE" }),
  reorder: (projectId: string, boardId: string, viewIds: string[]) =>
    request<BoardViews>(`${boardPath(projectId, boardId)}/order`, { method: "PUT", body: { viewIds } }),
  setDefault: (projectId: string, boardId: string, viewId: string | null) =>
    request<BoardViews>(`${boardPath(projectId, boardId)}/default`, { method: "PUT", body: { viewId } }),
});
export type BoardViewsClient = ReturnType<typeof createBoardViewsClient>;
