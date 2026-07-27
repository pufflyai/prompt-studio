import type {
  AttributeDescriptor,
  KanbanRendererFilterState,
  KanbanRendererRow,
} from "@/components/kanban-renderer/types";
import { filterRows } from "../kanban-renderer/kanban-renderer-grouping";
import { isDisplayValue } from "./helpers";
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

const toAttributeValue = (value: unknown) => {
  const raw = isDisplayValue(value) ? value.sortValue : value;
  if (typeof raw === "boolean") return String(raw);
  return raw;
};

const isNumberColumn = (rows: RowData[], columnKey: string) => {
  const values = rows
    .map((row) => toAttributeValue(row[columnKey]))
    .filter((value) => value !== null && value !== undefined);
  return values.length > 0 && values.every((value) => typeof value === "number");
};

const resolveAttributeType = (rows: RowData[], columnKey: string): AttributeDescriptor["type"] => {
  if (isNumberColumn(rows, columnKey)) return { kind: "number" };
  return { kind: "string" };
};

export const buildDataTableRendererAttributes = (
  rows: RowData[],
  columnKeys: string[],
  compactHeaders?: Partial<Record<string, string>>,
): AttributeDescriptor[] =>
  columnKeys.map((columnKey) => ({
    id: columnKey,
    label: compactHeaders?.[columnKey] ?? columnKey,
    type: resolveAttributeType(rows, columnKey),
    filterable: true,
    sortable: true,
    displayable: true,
  }));

export const buildDataTableRendererRows = (
  rows: RowData[],
  columnKeys: string[],
  getRowId?: DataTableProps["getRowId"],
): DataTableRendererRow[] =>
  rows.map((row, index) => {
    const attributes = Object.fromEntries(columnKeys.map((columnKey) => [columnKey, toAttributeValue(row[columnKey])]));
    const rowId = resolveDataTableRowId(row, index, getRowId);
    const firstValue = columnKeys.length > 0 ? toAttributeValue(row[columnKeys[0]!]) : rowId;

    return {
      id: rowId,
      title: String(firstValue ?? rowId),
      attributes,
      sourceRow: row,
    };
  });

export const filterDataTableRows = (
  rows: DataTableRendererRow[],
  filters: KanbanRendererFilterState,
  attributes: AttributeDescriptor[],
) => filterRows(rows, filters, attributes) as DataTableRendererRow[];

export const resolveDataTableColumnOrder = (availableColumnIds: string[], requestedColumnOrder: string[]) => {
  const availableColumnIdSet = new Set(availableColumnIds);
  const orderedColumnIds = requestedColumnOrder.filter((columnId) => availableColumnIdSet.has(columnId));
  const orderedColumnIdSet = new Set(orderedColumnIds);
  const missingColumnIds = availableColumnIds.filter((columnId) => !orderedColumnIdSet.has(columnId));

  return [...orderedColumnIds, ...missingColumnIds];
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
