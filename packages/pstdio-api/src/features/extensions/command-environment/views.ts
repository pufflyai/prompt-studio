import { boardViewCreateSchema, boardViewUpdateSchema } from "pstdio-api-contracts";
import type { ExtensionViewsApi, ViewRef } from "pstdio-api-contracts/extension-kernel";
import { createBoardViewsService } from "../../views/board-views-service";
import { BoardViewError } from "../../views/view-rules";
import type { ExtensionsRouteDeps } from "../deps";

/** Uses the project API's validation, storage, and sync events for every extension caller. */
export const createViewsApi = (
  deps: ExtensionsRouteDeps,
  input: { projectId: string; extensionId: string },
): ExtensionViewsApi => {
  const service = createBoardViewsService(deps);
  const boardId = (board: ViewRef) => `${board.extensionId ?? input.extensionId}.view.${board.id}`;
  const requireView = async (board: ViewRef, id: string) => {
    const view = await service.get(input.projectId, id);
    if (view.boardId !== boardId(board)) throw new BoardViewError("View does not belong to this board", 404);
  };
  return {
    list: (board) => service.list(input.projectId, boardId(board)),
    create: (board, value) => service.create(input.projectId, boardId(board), boardViewCreateSchema.parse(value)),
    update: async (board, id, value) => {
      await requireView(board, id);
      return service.update(input.projectId, id, boardViewUpdateSchema.parse(value));
    },
    remove: async (board, id) => {
      await requireView(board, id);
      return service.remove(input.projectId, id);
    },
    reorder: (board, ids) => service.reorder(input.projectId, boardId(board), ids),
    setDefault: (board, id) => service.setDefault(input.projectId, boardId(board), id),
  };
};
