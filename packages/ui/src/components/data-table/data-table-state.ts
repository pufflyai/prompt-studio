import { resolveDataTableFieldKind } from "@pstdio/sdk/extensions";
import { isValidElement, type ReactNode } from "react";
import type { AttributeDescriptor, KanbanRendererRow } from "@/components/kanban-renderer/types";
import { isDataTableDiffValue, resolveDataTableComparableValue } from "./data-table-cell-value";
import { formatDataTableRelativeDate } from "./data-table-date-cell";
import { getJsonCellSummary } from "./friendly-json-display";
import { formatDisplayValue } from "./helpers";
import type { DataTableProps, DataTableSelectionAction, RowData } from "./types";

export const defaultPageSize = 30;

export interface DataTableRendererRow extends KanbanRendererRow {
  sourceRow: RowData;
}

export const resolveDataTableRowId = (row: RowData, index: number, getRowId?: DataTableProps["getRowId"]) => {
  if (getRowId) return getRowId(row, index);
  return typeof row.id === "string" ? row.id : String(index);
};

export const resolveInitialPageSize = (props: Pick<DataTableProps, "initialPageSize">) => {
  if (typeof props.initialPageSize === "number" && props.initialPageSize > 0) return props.initialPageSize;
  return defaultPageSize;
};

export const getSelectedOriginalRows = (rows: Array<{ original: RowData }>) => rows.map((row) => row.original);

export const resolveSelectionActions = (
  props: Pick<DataTableProps, "selectionActions" | "onCSVDownload" | "getRowId">,
) => {
  const actions: DataTableSelectionAction[] = [...(props.selectionActions ?? [])];

  if (props.onCSVDownload) {
    actions.push({
      label: "Download CSV",
      onSelect: (rows) => {
        props.onCSVDownload?.(rows.map((row, index) => resolveDataTableRowId(row, index, props.getRowId)));
      },
    });
  }

  return actions;
};

export const shouldEnableSelection = (
  props: Pick<DataTableProps, "selectionMode" | "selectionActions" | "onCSVDownload">,
) => props.selectionMode === "multiple" || Boolean(props.onCSVDownload) || Boolean(props.selectionActions?.length);

export const shouldHighlightActiveRow = (props: {
  enableRowActivation?: boolean;
  activeRowId?: string | null;
  rowId: string;
}) => props.enableRowActivation === true && props.activeRowId === props.rowId;

type ColumnRenderers = DataTableProps["columnRenderers"];

const toAttributeValue = (value: unknown, renderer?: NonNullable<ColumnRenderers>[string]) => {
  const raw = resolveDataTableComparableValue(value, renderer);
  return raw;
};

type ColumnOptions = Pick<
  DataTableProps,
  "compactHeaders" | "columnRenderers" | "columnTypes" | "groupableColumns" | "filterableColumns"
>;

const resolveAttributeType = (
  rows: RowData[],
  columnKey: string,
  options: ColumnOptions,
): AttributeDescriptor["type"] => {
  return {
    kind: resolveDataTableFieldKind(
      rows.map((row) => row[columnKey]),
      { type: options.columnTypes?.[columnKey], renderer: options.columnRenderers?.[columnKey] },
    ),
  };
};

/** Every column is a view field, so filters, sorts, and grouping read them like board attributes. */
export const buildDataTableRendererAttributes = (
  rows: RowData[],
  columnKeys: string[],
  options: ColumnOptions = {},
): AttributeDescriptor[] =>
  columnKeys.map((columnKey) => ({
    id: columnKey,
    label: options.compactHeaders?.[columnKey] ?? columnKey,
    type: resolveAttributeType(rows, columnKey, options),
    filterable: options.filterableColumns?.includes(columnKey) ?? true,
    sortable: true,
    groupable: options.groupableColumns?.includes(columnKey) ?? false,
    displayable: true,
  }));

export const buildDataTableRendererRows = (
  rows: RowData[],
  columnKeys: string[],
  getRowId?: DataTableProps["getRowId"],
  renderers?: ColumnRenderers,
): DataTableRendererRow[] =>
  rows.map((row, index) => {
    const attributes = Object.fromEntries(
      columnKeys.map((columnKey) => [columnKey, toAttributeValue(row[columnKey], renderers?.[columnKey])]),
    );
    const rowId = resolveDataTableRowId(row, index, getRowId);
    const firstValue = columnKeys.length > 0 ? attributes[columnKeys[0]!] : rowId;

    return {
      id: rowId,
      title: String(firstValue ?? rowId),
      attributes,
      sourceRow: row,
    };
  });

export const resolveDataTableColumnOrder = (availableColumnIds: string[], requestedColumnOrder: string[]) => {
  const availableColumnIdSet = new Set(availableColumnIds);
  const orderedColumnIds = requestedColumnOrder.filter((columnId) => availableColumnIdSet.has(columnId));
  const orderedColumnIdSet = new Set(orderedColumnIds);
  const missingColumnIds = availableColumnIds.filter((columnId) => !orderedColumnIdSet.has(columnId));

  return [...orderedColumnIds, ...missingColumnIds];
};

export const toggleHiddenDataTableColumn = (hiddenColumnIds: string[], columnId: string, visible: boolean) =>
  visible ? hiddenColumnIds.filter((id) => id !== columnId) : [...new Set([...hiddenColumnIds, columnId])];

/** The text a cell shows, which is all that search looks at. */
const nodeText = (value: ReactNode): string[] => {
  if (typeof value === "string" || typeof value === "number") return [String(value)];
  if (Array.isArray(value)) return value.flatMap(nodeText);
  if (isValidElement<{ children?: ReactNode }>(value)) return nodeText(value.props.children);
  return [];
};
export const dataTableCellText = (
  value: unknown,
  renderer?: NonNullable<ColumnRenderers>[string],
  now = new Date(),
) => {
  if (renderer?.type === "json") return [getJsonCellSummary(value)];
  if (renderer?.type === "badge" && ["string", "number", "boolean"].includes(typeof value)) return [String(value)];
  if (renderer?.type === "date") {
    const label = formatDataTableRelativeDate(value, now);
    if (label) return [label];
  }
  if (renderer?.type === "diff" && isDataTableDiffValue(value)) return [`+${value.additions}`, `-${value.deletions}`];
  return nodeText(formatDisplayValue(value));
};

export const reorderDataTableColumns = (columnIds: string[], activeColumnId: string, overColumnId: string) => {
  const activeIndex = columnIds.indexOf(activeColumnId);
  const overIndex = columnIds.indexOf(overColumnId);

  if (activeIndex < 0 || overIndex < 0 || activeIndex === overIndex) return columnIds;

  const nextColumnIds = [...columnIds];
  const [activeColumn] = nextColumnIds.splice(activeIndex, 1);
  if (!activeColumn) return columnIds;

  nextColumnIds.splice(overIndex, 0, activeColumn);
  return nextColumnIds;
};

export const resolveDataTableToolbarStorageKey = (props: { toolbarStorageKey?: string; columnKeys: string[] }) =>
  props.toolbarStorageKey ?? `data-table:${props.columnKeys.join("|") || "empty"}`;
