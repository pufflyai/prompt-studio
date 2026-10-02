import type { ViewSort } from "@pstdio/sdk/extensions";
import type { KanbanRendererSettings } from "./types";
import { NO_GROUPING } from "./types";

interface ApplyBoardMoveItemInput {
  settings: Pick<KanbanRendererSettings, "columnGrouping" | "rowGrouping">;
  /** A sorted view decides its own order, so dropping a card only keeps its place without sorts. */
  sorts: ViewSort[];
  rowId: string;
  targetColumnId: string;
  targetGroupKey?: string;
  beforeItemId?: string;
  onAttributeChange?: (rowId: string, attributeId: string, value: unknown) => Promise<void> | void;
  onReorder?: (rowId: string, beforeRowId?: string) => Promise<void> | void;
}

interface ApplyBoardMoveToGroupInput {
  settings: Pick<KanbanRendererSettings, "rowGrouping">;
  sorts: ViewSort[];
  rowId: string;
  targetGroupKey: string;
  beforeItemId?: string;
  onAttributeChange?: (rowId: string, attributeId: string, value: unknown) => Promise<void> | void;
  onReorder?: (rowId: string, beforeRowId?: string) => Promise<void> | void;
}

export const applyBoardMoveItem = async (input: ApplyBoardMoveItemInput) => {
  const { settings, sorts, rowId, targetColumnId, targetGroupKey, beforeItemId, onAttributeChange, onReorder } = input;

  if (settings.columnGrouping !== NO_GROUPING && onAttributeChange) {
    await onAttributeChange(rowId, settings.columnGrouping, targetColumnId);
  }
  if (settings.rowGrouping !== NO_GROUPING && targetGroupKey && onAttributeChange) {
    await onAttributeChange(rowId, settings.rowGrouping, targetGroupKey);
  }
  if (sorts.length === 0) await onReorder?.(rowId, beforeItemId);
};

export const applyBoardMoveToGroup = async (input: ApplyBoardMoveToGroupInput) => {
  const { settings, sorts, rowId, targetGroupKey, beforeItemId, onAttributeChange, onReorder } = input;

  if (settings.rowGrouping === NO_GROUPING || !onAttributeChange) return;
  await onAttributeChange(rowId, settings.rowGrouping, targetGroupKey);
  if (sorts.length === 0) await onReorder?.(rowId, beforeItemId);
};
