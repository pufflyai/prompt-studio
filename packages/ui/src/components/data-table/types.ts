import type { ReactNode } from "react";

export type ColumnType = "boolean" | "date" | "number" | "string" | "unknown";

export type RowData = Record<string, unknown>;

export type DisplayValue = { display: ReactNode; sortValue?: unknown };

export interface DataTableSelectionAction {
  label: string;
  icon?: ReactNode;
  destructive?: boolean;
  onSelect: (rows: RowData[]) => void;
}

export interface DataTableRowAction {
  label: string;
  icon?: ReactNode;
  destructive?: boolean;
  onSelect: (row: RowData) => void;
}

export interface DataTableCellContext {
  row: RowData;
  rowId: string;
  columnId: string;
  value: unknown;
}

export interface DataTableCellContextAction {
  label: string;
  icon?: ReactNode;
  destructive?: boolean;
  onSelect: (context: DataTableCellContext) => void;
}

export interface DataTableProps {
  data: RowData[];
  isReadOnly?: boolean;
  noBorder?: boolean;
  fullWidth?: boolean;
  initialPageSize?: number;
  pageSizeOptions?: number[];
  selectionMode?: "none" | "multiple";
  selectionActions?: DataTableSelectionAction[];
  rowActions?: DataTableRowAction[];
  compactHeaders?: Partial<Record<string, string>>;
  getRowId?: (row: RowData, index: number) => string;
  toolbarStorageKey?: string;
  enableRowActivation?: boolean;
  getCellContextMenuActions?: (context: DataTableCellContext) => DataTableCellContextAction[];
  onCSVUpload?: (csv: string) => Promise<void>;
  onCSVDownload?: (scenarios: string[]) => void;
  hiddenColumns?: string[];
  onRowClick?: (row: RowData) => void;
  isRowInteractive?: (row: RowData) => boolean;
  activeRowId?: string | null;
  columnIcons?: Partial<Record<string, ReactNode>>;
}
