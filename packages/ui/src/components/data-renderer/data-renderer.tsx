import { Stack } from "@chakra-ui/react";
import type { ReactNode } from "react";

import type { ResourceContextAction } from "../resource-context-menu";
import type {
  DataRendererBoardColumn,
  DataRendererBoardColumnAction,
  DataRendererBoardGroup,
} from "./data-renderer-board";
import { DataRendererContent } from "./data-renderer-content";
import { type DataRendererColumnGroup, filterRows, groupRows, orderRows } from "./data-renderer-grouping";
import {
  collectDisplayBadges,
  collectDisplayCustomSlots,
  findEnumOption,
  resolveKnownColumnKeys,
  resolveListDropTargetColumnKey,
} from "./data-renderer-helpers";
import type { DataRendererListItem } from "./data-renderer-list";
import { DataRendererToolbar } from "./data-renderer-toolbar";
import type { AttributeDescriptor, DataRendererFilterState, DataRendererRow, DataRendererSettings } from "./types";
import { findAttribute, MANUAL_ORDERING, NO_GROUPING } from "./types";
import { useDataRendererStore } from "./use-data-renderer-store";
import { useResolvedAttributes } from "./use-resolved-attributes";

export interface BoardColumnConfig {
  color?: string;
  canDragIn?: boolean;
  canDragOut?: boolean;
  canCreate?: boolean;
  actions?: DataRendererBoardColumnAction[];
}

export interface DataRendererProps<TRow extends DataRendererRow = DataRendererRow> {
  rows: TRow[];
  storageKey: string;
  attributes: AttributeDescriptor[];
  selectedRowId?: string | null;
  emptyState?: ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  defaultSettings?: Partial<DataRendererSettings>;
  defaultFilters?: DataRendererFilterState;
  hideToolbar?: boolean;
  toolbarLeading?: ReactNode;
  onRowClick?: (row: TRow) => void;
  onAttributeChange?: (rowId: string, attributeId: string, value: unknown) => void;
  onReorder?: (rowId: string, beforeRowId?: string) => void;
  onCreateRow?: (columnId: string) => void;
  onColumnAction?: (columnId: string, actionId: string) => Promise<void> | void;
  getBoardColumnConfig?: (groupKey: string) => BoardColumnConfig;
  getRowContextMenuActions?: (row: TRow) => ResourceContextAction[];
}

interface BuildListItemsInput<TRow extends DataRendererRow> {
  settings: DataRendererSettings;
  visibleRows: TRow[];
  grouped: DataRendererColumnGroup[];
  attributes: AttributeDescriptor[];
  onRowClick?: (row: TRow) => void;
  onAttributeChange?: (rowId: string, attributeId: string, value: unknown) => void;
  onReorder?: (rowId: string, beforeRowId?: string) => void;
  getRowContextMenuActions?: (row: TRow) => ResourceContextAction[];
}

const buildListItems = <TRow extends DataRendererRow>(input: BuildListItemsInput<TRow>): DataRendererListItem[] => {
  const {
    settings,
    visibleRows,
    grouped,
    attributes,
    onRowClick,
    onAttributeChange,
    onReorder,
    getRowContextMenuActions,
  } = input;

  const supportsManualReorder = settings.ordering.attributeId === MANUAL_ORDERING;
  const getGroupColorPalette = (attributeId: string, key: string) => {
    const descriptor = findAttribute(attributes, attributeId);
    return descriptor ? findEnumOption(descriptor.type, key)?.color : undefined;
  };

  const toListItem = (row: TRow, placement?: { columnKey?: string; rowKey?: string }): DataRendererListItem => ({
    id: row.id,
    title: row.title,
    badges: collectDisplayBadges(row, attributes, settings.displayProperties),
    customSlots: collectDisplayCustomSlots(row, attributes, settings.displayProperties),
    contextMenuActions: getRowContextMenuActions?.(row),
    onClick: () => onRowClick?.(row),
    draggable: Boolean(onAttributeChange || onReorder),
    onDropRow:
      supportsManualReorder && (onAttributeChange || onReorder)
        ? (draggedId) => {
            const targetColumnKey = resolveListDropTargetColumnKey(settings.columnGrouping, placement);
            if (targetColumnKey && settings.columnGrouping !== NO_GROUPING && onAttributeChange) {
              onAttributeChange(draggedId, settings.columnGrouping, targetColumnKey);
            }
            if (settings.rowGrouping !== NO_GROUPING && placement?.rowKey && onAttributeChange) {
              onAttributeChange(draggedId, settings.rowGrouping, placement.rowKey);
            }
            onReorder?.(draggedId, row.id);
          }
        : undefined,
  });

  const toSubgroupListItem = (
    subgroup: { key: string; label: string; rows: DataRendererRow[] },
    parent?: { columnKey: string },
  ): DataRendererListItem => ({
    id: parent ? `group::${parent.columnKey}::${subgroup.key}` : `group::${subgroup.key}`,
    title: subgroup.label,
    countBadge: subgroup.rows.length,
    countColorPalette: getGroupColorPalette(parent ? settings.rowGrouping : settings.columnGrouping, subgroup.key),
    onDropRow:
      onAttributeChange && settings.columnGrouping !== NO_GROUPING
        ? (draggedId) => {
            const columnKey = parent?.columnKey ?? subgroup.key;
            onAttributeChange(draggedId, settings.columnGrouping, columnKey);
            if (settings.rowGrouping !== NO_GROUPING && parent) {
              onAttributeChange(draggedId, settings.rowGrouping, subgroup.key);
            }
          }
        : undefined,
    children: orderRows(subgroup.rows, settings.ordering, attributes).map((row) =>
      toListItem(row as TRow, {
        columnKey: parent?.columnKey ?? subgroup.key,
        rowKey: parent ? subgroup.key : undefined,
      }),
    ),
  });

  if (settings.columnGrouping === NO_GROUPING) {
    return orderRows(visibleRows, settings.ordering, attributes).map((row) => toListItem(row as TRow));
  }

  return grouped.map((column) => {
    if (column.subgroups.length > 0) {
      return {
        id: `group::${column.key}`,
        title: column.label,
        countBadge: column.rows.length,
        countColorPalette: getGroupColorPalette(settings.columnGrouping, column.key),
        onDropRow: onAttributeChange
          ? (draggedId: string) => onAttributeChange(draggedId, settings.columnGrouping, column.key)
          : undefined,
        children: column.subgroups.map((subgroup) => toSubgroupListItem(subgroup, { columnKey: column.key })),
      } satisfies DataRendererListItem;
    }

    return toSubgroupListItem(column);
  });
};

export const DataRenderer = <TRow extends DataRendererRow>(props: DataRendererProps<TRow>) => {
  const {
    rows,
    storageKey,
    attributes: rawAttributes,
    selectedRowId = null,
    emptyState,
    emptyTitle = "No rows found",
    emptyDescription = "Try changing filters or display settings.",
    defaultSettings,
    defaultFilters,
    onRowClick,
    onAttributeChange,
    onReorder,
    onCreateRow,
    onColumnAction,
    getBoardColumnConfig,
    getRowContextMenuActions,
    hideToolbar = false,
    toolbarLeading,
  } = props;

  const attributes = useResolvedAttributes(rawAttributes);
  const initialState = { settings: defaultSettings, filters: defaultFilters };
  const settings = useDataRendererStore(storageKey, (state) => state.settings, initialState);
  const filters = useDataRendererStore(storageKey, (state) => state.filters, initialState);

  const visibleRows = filterRows(rows, filters, attributes) as TRow[];

  const knownColumnKeys = resolveKnownColumnKeys(settings.columnGrouping, attributes, filters);

  const grouped = groupRows(visibleRows, {
    attributes,
    columnGrouping: settings.columnGrouping,
    rowGrouping: settings.rowGrouping,
    knownColumnKeys,
  });

  const listItems = buildListItems({
    settings,
    visibleRows,
    grouped,
    attributes,
    onRowClick,
    onAttributeChange,
    onReorder,
    getRowContextMenuActions,
  });

  const toBoardItems = (boardRows: DataRendererRow[]) =>
    boardRows.map((row) => ({
      id: row.id,
      contextMenuActions: getRowContextMenuActions?.(row as TRow),
      cardProps: {
        title: row.title,
        badges: collectDisplayBadges(row, attributes, settings.displayProperties),
        customSlots: collectDisplayCustomSlots(row, attributes, settings.displayProperties),
        onClick: () => onRowClick?.(row as TRow),
      },
    }));

  const columnGroupingDescriptor = findAttribute(attributes, settings.columnGrouping);

  const boardColumns: DataRendererBoardColumn[] = grouped.map((column) => {
    const columnConfig = getBoardColumnConfig?.(column.key) ?? {};
    const orderedRows = orderRows(column.rows, settings.ordering, attributes);
    // Fall back to the enum option's declared color when the contribution
    // doesn't provide one — keeps the board in sync with the schema by
    // default (matches how card / list badges already pick up enum colors).
    const enumColor = columnGroupingDescriptor
      ? findEnumOption(columnGroupingDescriptor.type, column.key)?.color
      : undefined;

    const groups: DataRendererBoardGroup[] | undefined =
      column.subgroups.length > 0
        ? column.subgroups.map((subgroup) => ({
            key: subgroup.key,
            label: subgroup.label,
            items: toBoardItems(orderRows(subgroup.rows, settings.ordering, attributes)),
          }))
        : undefined;

    return {
      id: column.key,
      label: column.label,
      color: columnConfig.color ?? enumColor,
      canDragIn: columnConfig.canDragIn ?? false,
      canDragOut: columnConfig.canDragOut ?? false,
      canCreate: columnConfig.canCreate ?? false,
      actions: columnConfig.actions ?? [],
      items: toBoardItems(orderedRows),
      groups,
    } satisfies DataRendererBoardColumn;
  });

  const handleBoardMoveItem = (rowId: string, targetColumnId: string) => {
    if (settings.columnGrouping === NO_GROUPING || !onAttributeChange) return;
    onAttributeChange(rowId, settings.columnGrouping, targetColumnId);
  };

  const handleBoardMoveToGroup = (rowId: string, targetGroupKey: string) => {
    if (settings.rowGrouping === NO_GROUPING || !onAttributeChange) return;
    onAttributeChange(rowId, settings.rowGrouping, targetGroupKey);
  };

  return (
    <Stack gap="sm" height="100%" minH="0">
      {hideToolbar ? null : (
        <DataRendererToolbar
          rows={rows}
          storageKey={storageKey}
          attributes={attributes}
          defaultSettings={defaultSettings}
          defaultFilters={defaultFilters}
          leading={toolbarLeading}
        />
      )}

      <DataRendererContent
        viewMode={settings.viewMode}
        boardColumns={boardColumns}
        listItems={listItems}
        selectedRowId={selectedRowId}
        emptyState={emptyState}
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
        onBoardMoveItem={handleBoardMoveItem}
        onBoardMoveToGroup={handleBoardMoveToGroup}
        onCreateRow={onCreateRow}
        onColumnAction={onColumnAction}
        listKey={`${settings.columnGrouping}:${settings.rowGrouping}`}
      />
    </Stack>
  );
};
