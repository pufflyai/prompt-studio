import type { KanbanRendererMove } from "@pstdio/sdk/extensions";
import type { KanbanRendererContribution } from "../../../core";

type MoveCallbacks = Pick<KanbanRendererContribution, "onMove" | "onAttributeChange" | "onReorder">;

export const prepareKanbanMove = (callbacks: MoveCallbacks, move: KanbanRendererMove) => {
  const { onMove, onAttributeChange, onReorder } = callbacks;
  if (onMove) return { move, save: () => onMove(move) };
  const supportedMove: KanbanRendererMove = {
    rowId: move.rowId,
    attributes: onAttributeChange ? move.attributes : {},
    order: onReorder ? move.order : undefined,
  };
  return {
    move: supportedMove,
    save: async () => {
      for (const [attributeId, value] of Object.entries(supportedMove.attributes)) {
        await onAttributeChange!(move.rowId, attributeId, value);
      }
      if (supportedMove.order) await onReorder!(move.rowId, supportedMove.order.beforeRowId);
    },
  };
};
