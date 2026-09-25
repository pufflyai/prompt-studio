import type { RowSelectionState } from "@tanstack/react-table";
import type { CSSProperties, ReactNode } from "react";
import type { DataTableColumnRenderer, DataTableRowAction, RowData } from "./types";

export interface DataTableColumnMeta {
  headerLabel?: string;
  headerIcon?: ReactNode;
  columnDescription?: string;
  renderer?: DataTableColumnRenderer;
  wrapRows?: boolean;
  selectedRowIds?: RowSelectionState;
  rowActions?: DataTableRowAction[];
  getRowActions?: (row: RowData) => DataTableRowAction[];
  getCellStyle?: (value: unknown) => CSSProperties | undefined;
}
