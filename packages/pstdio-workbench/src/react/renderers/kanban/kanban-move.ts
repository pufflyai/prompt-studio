import type { KanbanRendererMove } from "@pstdio/sdk/extensions";
import type { KanbanRendererContribution, WorkbenchCore } from "../../../core";
import { runUserAction } from "../../../core/shared/run-user-action";

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

export const bindKanbanRowWrites = (
  contribution: MoveCallbacks,
  submit: (move: KanbanRendererMove, write: () => Promise<void> | void) => Promise<void>,
) => ({
  onAttributeChange: contribution.onAttributeChange
    ? (rowId: string, attributeId: string, value: unknown) =>
        submit({ rowId, attributes: { [attributeId]: value } }, () =>
          contribution.onAttributeChange!(rowId, attributeId, value),
        )
    : undefined,
  onMove:
    contribution.onMove || contribution.onAttributeChange
      ? (move: KanbanRendererMove) => {
          const mutation = prepareKanbanMove(contribution, move);
          return submit(mutation.move, mutation.save);
        }
      : undefined,
  onReorder: contribution.onReorder
    ? (rowId: string, beforeRowId?: string) =>
        submit({ rowId, attributes: {}, order: { beforeRowId } }, () => contribution.onReorder!(rowId, beforeRowId))
    : undefined,
});

export const isPlannerTicketsBoard = (sourceId: string) =>
  sourceId === "pstdio.planner.view.tickets" || sourceId === "pstdio.pstdio-planner.view.tickets";

export const bindKanbanColumnAction = (
  action: KanbanRendererContribution["onColumnAction"],
  workbench: WorkbenchCore,
  run: (columnId: string, actionId: string, write: () => Promise<void> | void) => Promise<void>,
) =>
  action &&
  ((columnId: string, actionId: string) =>
    runUserAction(workbench, "Column action", () => run(columnId, actionId, () => action(columnId, actionId))));
