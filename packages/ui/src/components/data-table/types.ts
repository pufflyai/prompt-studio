import type { ReactNode } from "react";
import type { KanbanRendererSavedView } from "../kanban-renderer/types";

export type ColumnType = "boolean" | "date" | "number" | "string" | "unknown";

export type RowData = Record<string, unknown>;

export type DisplayValue = { display: ReactNode; sortValue?: unknown };

export interface DataTableThemeColor {
  light: string;
  dark: string;
  foreground?: {
    light: string;
    dark: string;
  };
}

export interface DataTableColorScaleStop {
  value: number;
  color: DataTableThemeColor;
}

export type DataTableCategoricalValue = string | number | boolean | null;

export interface DataTableCategoricalColor {
  value: DataTableCategoricalValue;
  color: DataTableThemeColor;
}

export type DataTableColumnRenderer =
  | { type: "json" }
  | { type: "color-scale"; stops: DataTableColorScaleStop[] }
  | { type: "categorical-color"; categories: DataTableCategoricalColor[] };

export type DataTableColumnStat =
  | { type: "unique" }
  | { type: "histogram"; bins?: number }
  | { type: "top-values"; limit?: number };

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

export type DataTableEditModeAlignment = "left" | "center" | "right" | null;

export interface DataTableEditModeColumn {
  id: string;
  label: string;
  alignment: DataTableEditModeAlignment;
}

export interface DataTableEditModeCellEditorProps {
  context: DataTableCellContext;
  value: string;
  onChange: (value: string) => void;
}

export interface DataTableEditModeConfig {
  columns: DataTableEditModeColumn[];
  onDataChange: (data: RowData[]) => void;
  onColumnsChange: (columns: DataTableEditModeColumn[]) => void;
  isCellEditable?: (context: DataTableCellContext) => boolean;
  renderHeader?: (column: DataTableEditModeColumn) => ReactNode;
  renderCell?: (context: DataTableCellContext) => ReactNode;
  renderCellEditor?: (props: DataTableEditModeCellEditorProps) => ReactNode;
}

export interface DataTableProps {
  data: RowData[];
  editMode?: DataTableEditModeConfig;
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
  defaultViews?: KanbanRendererSavedView[];
  defaultActiveViewId?: string;
  enableRowActivation?: boolean;
  getCellContextMenuActions?: (context: DataTableCellContext) => DataTableCellContextAction[];
  onCSVUpload?: (csv: string) => Promise<void>;
  onCSVDownload?: (scenarios: string[]) => void;
  hiddenColumns?: string[];
  onRowClick?: (row: RowData) => void;
  isRowInteractive?: (row: RowData) => boolean;
  activeRowId?: string | null;
  columnIcons?: Partial<Record<string, ReactNode>>;
  columnDescriptions?: Partial<Record<string, string>>;
  columnStats?: Partial<Record<string, DataTableColumnStat>>;
  columnRenderers?: Partial<Record<string, DataTableColumnRenderer>>;
}
