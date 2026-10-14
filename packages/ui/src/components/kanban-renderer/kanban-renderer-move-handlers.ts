import type { ViewSort } from "@pstdio/sdk/extensions";
import { buildKanbanMove } from "./kanban-move";
import type { KanbanRendererProps } from "./kanban-renderer";
import { runKanbanAction } from "./kanban-renderer-action";
import { applyBoardMoveItem, applyBoardMoveToGroup } from "./kanban-renderer-board-move";
import type { KanbanRendererRow, KanbanRendererSettings } from "./types";
export const kanbanMoveHandlers = <TRow extends KanbanRendererRow>(
  input: Pick<KanbanRendererProps<TRow>, "onMove" | "onActionError" | "onAttributeChange" | "onReorder"> & {
    settings: KanbanRendererSettings;
    sorts: ViewSort[];
  },
) => {
  const { settings, sorts, onMove, onActionError, onAttributeChange, onReorder } = input;
  const handleBoardMoveItem = async (
    rowId: string,
    targetColumnId: string,
    context?: { beforeItemId?: string; targetGroupKey?: string },
  ) => {
    await runKanbanAction(
      "Move row",
      () =>
        onMove
          ? onMove(
              buildKanbanMove({
                rowId,
                ...settings,
                sorts,
                targetColumnId,
                targetGroupKey: context?.targetGroupKey,
                beforeRowId: context?.beforeItemId,
              }),
            )
          : applyBoardMoveItem({
              settings,
              sorts,
              rowId,
              targetColumnId,
              targetGroupKey: context?.targetGroupKey,
              beforeItemId: context?.beforeItemId,
              onAttributeChange,
              onReorder,
            }),
      onActionError,
    );
  };

  const handleBoardMoveToGroup = async (rowId: string, targetGroupKey: string, context?: { beforeItemId?: string }) => {
    await runKanbanAction(
      "Move row",
      () =>
        onMove
          ? onMove(
              buildKanbanMove({
                rowId,
                rowGrouping: settings.rowGrouping,
                sorts,
                targetGroupKey,
                beforeRowId: context?.beforeItemId,
              }),
            )
          : applyBoardMoveToGroup({
              settings,
              sorts,
              rowId,
              targetGroupKey,
              beforeItemId: context?.beforeItemId,
              onAttributeChange,
              onReorder,
            }),
      onActionError,
    );
  };

  return { handleBoardMoveItem, handleBoardMoveToGroup };
};
