import { useEffect, useState } from "react";
import type { DataTableEditDraft, DataTableEditModeColumn, DataTableProps, RowData } from "./types";

interface CellDraft {
  rowId: string;
  columnId: string;
  draft: string;
  transaction?: DataTableEditDraft;
}
interface HeaderDraft {
  columnId: string;
  draft: string;
  transaction?: DataTableEditDraft;
}

export const useDataTableDrafts = (input: Pick<DataTableProps, "data" | "editMode" | "getRowId" | "isReadOnly">) => {
  const { data, editMode, getRowId, isReadOnly } = input;
  const [activeCell, setActiveCell] = useState<CellDraft | null>(null);
  const [activeHeader, setActiveHeader] = useState<HeaderDraft | null>(null);
  const cellTransaction = activeCell?.transaction;
  const headerTransaction = activeHeader?.transaction;
  useEffect(() => () => cellTransaction?.dispose(), [cellTransaction]);
  useEffect(() => () => headerTransaction?.dispose(), [headerTransaction]);
  const rowIdFor = (row: RowData, index: number) => getRowId?.(row, index) ?? String(row.id ?? index);
  useEffect(() => {
    const columns = new Set(editMode?.columns.map((column) => column.id));
    setActiveCell((current) => {
      if (!current) return current;
      const exists =
        columns.has(current.columnId) &&
        data.some((row, index) => (getRowId?.(row, index) ?? String(row.id ?? index)) === current.rowId);
      return exists && !isReadOnly ? current : null;
    });
    setActiveHeader((current) => (current && (!columns.has(current.columnId) || isReadOnly) ? null : current));
  }, [data, editMode, getRowId, isReadOnly]);
  return {
    activeCell,
    activeHeader,
    rowIdFor,
    openCell(cell: Omit<CellDraft, "transaction">) {
      setActiveCell({
        ...cell,
        transaction: editMode?.createDraft?.({
          kind: "cell",
          rowId: cell.rowId,
          columnId: cell.columnId,
          value: cell.draft,
        }),
      });
    },
    changeCell(cell: Omit<CellDraft, "transaction">) {
      if (activeCell?.rowId === cell.rowId && activeCell.columnId === cell.columnId)
        activeCell.transaction?.update?.(cell.draft);
      setActiveCell((current) =>
        current?.rowId === cell.rowId && current.columnId === cell.columnId
          ? { ...current, draft: cell.draft }
          : current,
      );
    },
    cancelCell() {
      if (activeCell?.transaction?.cancel?.() === false) return;
      setActiveCell(null);
    },
    commitCell() {
      if (!activeCell || !editMode) return;
      if (activeCell.transaction) activeCell.transaction.commit(activeCell.draft);
      else
        editMode.onDataChange(
          data.map((row, index) =>
            rowIdFor(row, index) === activeCell.rowId ? { ...row, [activeCell.columnId]: activeCell.draft } : row,
          ),
        );
      setActiveCell(null);
    },
    openHeader(column: DataTableEditModeColumn) {
      setActiveHeader({
        columnId: column.id,
        draft: column.label,
        transaction: editMode?.createDraft?.({ kind: "header", columnId: column.id, value: column.label }),
      });
    },
    changeHeader(draft: string) {
      activeHeader?.transaction?.update?.(draft);
      setActiveHeader((current) => (current ? { ...current, draft } : current));
    },
    cancelHeader() {
      if (activeHeader?.transaction?.cancel?.() === false) return;
      setActiveHeader(null);
    },
    commitHeader() {
      if (!activeHeader || !editMode) return;
      if (activeHeader.transaction) activeHeader.transaction.commit(activeHeader.draft);
      else
        editMode.onColumnsChange(
          editMode.columns.map((column) =>
            column.id === activeHeader.columnId ? { ...column, label: activeHeader.draft } : column,
          ),
        );
      setActiveHeader(null);
    },
  };
};
