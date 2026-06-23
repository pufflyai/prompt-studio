import type { DataRendererSettings } from "./types";
import { MANUAL_ORDERING, NO_GROUPING } from "./types";

interface ApplyBoardMoveItemInput {
  settings: Pick<DataRendererSettings, "columnGrouping" | "ordering" | "rowGrouping">;
  rowId: string;
  targetColumnId: string;
  targetGroupKey?: string;
  beforeItemId?: string;
  onAttributeChange?: (rowId: string, attributeId: string, value: unknown) => Promise<void> | void;
  onReorder?: (rowId: string, beforeRowId?: string) => Promise<void> | void;
}

interface ApplyBoardMoveToGroupInput {
  settings: Pick<DataRendererSettings, "ordering" | "rowGrouping">;
  rowId: string;
  targetGroupKey: string;
  beforeItemId?: string;
  onAttributeChange?: (rowId: string, attributeId: string, value: unknown) => Promise<void> | void;
  onReorder?: (rowId: string, beforeRowId?: string) => Promise<void> | void;
}

export const applyBoardMoveItem = async (input: ApplyBoardMoveItemInput) => {
  const { settings, rowId, targetColumnId, targetGroupKey, beforeItemId, onAttributeChange, onReorder } = input;

  if (settings.columnGrouping !== NO_GROUPING && onAttributeChange) {
    await onAttributeChange(rowId, settings.columnGrouping, targetColumnId);
  }
  if (settings.rowGrouping !== NO_GROUPING && targetGroupKey && onAttributeChange) {
    await onAttributeChange(rowId, settings.rowGrouping, targetGroupKey);
  }
  if (settings.ordering.attributeId === MANUAL_ORDERING) {
    await onReorder?.(rowId, beforeItemId);
  }
};

export const applyBoardMoveToGroup = async (input: ApplyBoardMoveToGroupInput) => {
  const { settings, rowId, targetGroupKey, beforeItemId, onAttributeChange, onReorder } = input;

  if (settings.rowGrouping === NO_GROUPING || !onAttributeChange) return;
  await onAttributeChange(rowId, settings.rowGrouping, targetGroupKey);
  if (settings.ordering.attributeId === MANUAL_ORDERING) {
    await onReorder?.(rowId, beforeItemId);
  }
};
