import type { KanbanRendererMove, ViewSort } from "@pstdio/sdk/extensions";
import type { KanbanRendererRow } from "./types";

interface BuildMoveInput {
  rowId: string;
  columnGrouping?: string;
  rowGrouping: string;
  targetColumnId?: string;
  targetGroupKey?: string;
  beforeRowId?: string;
  sorts: ViewSort[];
}

export const buildKanbanMove = (input: BuildMoveInput) => {
  const { rowId, columnGrouping, rowGrouping, targetColumnId, targetGroupKey, beforeRowId, sorts } = input;
  const attributes: Record<string, unknown> = {};
  const add = (attributeId: string | undefined, value: string | undefined) => {
    if (!attributeId || attributeId === "none" || value === undefined) return;
    attributes[attributeId] = value;
  };
  add(columnGrouping, targetColumnId);
  add(rowGrouping, targetGroupKey);
  return { rowId, attributes, ...(sorts.length === 0 ? { order: { beforeRowId } } : {}) };
};

export const applyKanbanMove = <TRow extends KanbanRendererRow>(rows: TRow[], move: KanbanRendererMove) => {
  const existing = rows.find((row) => row.id === move.rowId);
  if (!existing) return rows;
  const moving = Object.keys(move.attributes).length
    ? { ...existing, attributes: { ...existing.attributes, ...move.attributes } }
    : existing;
  if (!move.order) return rows.map((row) => (row.id === move.rowId ? moving : row));
  if (move.order.beforeRowId === move.rowId) return rows;
  const remaining = rows.filter((row) => row.id !== move.rowId);
  const target = remaining.findIndex((row) => row.id === move.order?.beforeRowId);
  const index = target < 0 ? remaining.length : target;
  return [...remaining.slice(0, index), moving, ...remaining.slice(index)];
};
