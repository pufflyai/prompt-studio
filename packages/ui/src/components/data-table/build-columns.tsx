import type { RowSelectionState } from "@tanstack/react-table";
import type { ReactNode } from "react";
import { resolveCategoricalColor } from "./categorical-color-cell";
import { resolveColorCellStyle } from "./color-cell-style";
import { resolveColorScaleValue } from "./color-scale-cell";
import {
  ColumnDataCell,
  ColumnHeader,
  RowActionsCell,
  RowIndexCell,
  SelectionCell,
  SelectionHeader,
} from "./data-table-cell-renderers";
import type { DataTableColumnMeta } from "./data-table-column-meta";
import { columnHelper, getIcon, isDisplayValue } from "./helpers";
import type { DataTableColumnRenderer, DataTableRowAction, RowData } from "./types";

const getSortValue = (value: unknown) => {
  return isDisplayValue(value) ? value.sortValue : value;
};

const compareValues = (valueA: unknown, valueB: unknown) => {
  if (valueA === valueB) return 0;
  if (valueA === null || valueA === undefined) return 1;
  if (valueB === null || valueB === undefined) return -1;

  if (typeof valueA === "number" && typeof valueB === "number") {
    return valueA - valueB;
  }

  return String(valueA).localeCompare(String(valueB));
};

interface BuildColumnsOptions {
  columnIcons?: Partial<Record<string, ReactNode>>;
  columnDescriptions?: Partial<Record<string, string>>;
  compactHeaders?: Partial<Record<string, string>>;
  enableSelection?: boolean;
  selectedRowIds?: RowSelectionState;
  rowActions?: DataTableRowAction[];
  getRowActions?: (row: RowData) => DataTableRowAction[];
  columnRenderers?: Partial<Record<string, DataTableColumnRenderer>>;
  wrapRows?: boolean;
}

const resolveDataCellStyle = (value: unknown, renderer?: DataTableColumnRenderer) => {
  if (renderer?.type === "color-scale") {
    const color = resolveColorScaleValue(value, renderer.stops);
    if (color && typeof value === "number") return resolveColorCellStyle(color);
  }

  if (renderer?.type === "categorical-color") {
    const color = resolveCategoricalColor(value, renderer.categories);
    if (color) return resolveColorCellStyle(color);
  }
};

export function buildColumns(data: RowData[], columnKeys: string[], options: BuildColumnsOptions = {}) {
  const {
    columnIcons,
    columnDescriptions,
    compactHeaders,
    enableSelection = false,
    selectedRowIds,
    rowActions = [],
    getRowActions,
    columnRenderers,
    wrapRows = false,
  } = options;
  const rowIndexColumn = columnHelper.accessor((_row, rowIndex) => rowIndex + 1, {
    header: "",
    id: "rowIndex",
    enableResizing: false,
    size: 20,
    cell: RowIndexCell,
  });

  const selectionColumn = columnHelper.display({
    id: "rowSelection",
    header: SelectionHeader,
    cell: SelectionCell,
    meta: { selectedRowIds } satisfies DataTableColumnMeta,
    enableResizing: false,
    enableSorting: false,
    size: 36,
  });

  const dataColumns = columnKeys.map((key) => {
    const fallBackKey = key || "-";
    const columnValues = data.map((row) => row[fallBackKey]);
    const renderer = columnRenderers?.[fallBackKey];
    const customIcon = columnIcons?.[fallBackKey];
    const headerIcon = customIcon === undefined ? getIcon(columnValues) : customIcon;
    const columnDescription = columnDescriptions?.[fallBackKey];

    return columnHelper.accessor((row) => row[fallBackKey], {
      id: fallBackKey,
      header: ColumnHeader,
      cell: ColumnDataCell,
      meta: {
        headerLabel: compactHeaders?.[fallBackKey] ?? fallBackKey,
        headerIcon,
        columnDescription,
        renderer,
        wrapRows,
        getCellStyle: (value: unknown) => resolveDataCellStyle(value, renderer),
      } satisfies DataTableColumnMeta,
      sortingFn: (rowA, rowB) => {
        const valueA = getSortValue(rowA.original[fallBackKey]);
        const valueB = getSortValue(rowB.original[fallBackKey]);
        return compareValues(valueA, valueB);
      },
    });
  });

  const rowActionsColumn = columnHelper.display({
    id: "rowActions",
    header: "",
    cell: RowActionsCell,
    meta: { rowActions, getRowActions } satisfies DataTableColumnMeta,
    enableResizing: false,
    enableSorting: false,
    size: 36,
  });

  return [
    rowIndexColumn,
    ...(enableSelection ? [selectionColumn] : []),
    ...dataColumns,
    ...(rowActions.length > 0 || getRowActions ? [rowActionsColumn] : []),
  ];
}
