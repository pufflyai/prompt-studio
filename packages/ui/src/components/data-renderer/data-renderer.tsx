import { Stack } from "@chakra-ui/react";
import { type ReactNode, useState } from "react";

import type { ResourceContextAction } from "@/components/overlays/resource-context-menu";
import type {
  DataRendererBoardColumn,
  DataRendererBoardColumnAction,
  DataRendererBoardGroup,
} from "./data-renderer-board";
import { applyBoardMoveItem, applyBoardMoveToGroup } from "./data-renderer-board-move";
import { DataRendererContent } from "./data-renderer-content";
import { DataRendererCreateDialog } from "./data-renderer-create-dialog";
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
import type {
  AttributeDescriptor,
  DataRendererCreateRowConfig,
  DataRendererCreateSubmission,
  DataRendererFilterState,
  DataRendererRow,
  DataRendererSettings,
} from "./types";
import { findAttribute, MANUAL_ORDERING, NO_GROUPING } from "./types";
import { useDataRendererStore } from "./use-data-renderer-store";
import { useResolvedAttributes } from "./use-resolved-attributes";

/** Board-column behavior and menu configuration for a resolved column group. */
export interface BoardColumnConfig {
  /** Chakra color palette used for the column header and group badges. */
  color?: string;
  canDragIn?: boolean;
  canDragOut?: boolean;
  canCreate?: boolean;
  actions?: DataRendererBoardColumnAction[];
}

/** Switchable list/board renderer for rows with typed attributes, filtering, grouping, and ordering. */
export interface DataRendererProps<TRow extends DataRendererRow = DataRendererRow> {
  /** Stable rows to render. Each row must have an id, title, and attributes map. */
  rows: TRow[];
  /** Persistent key used by the renderer store for view, filter, grouping, ordering, and list expansion settings. */
  storageKey: string;
  /** Attribute descriptors that define display, filtering, grouping, ordering, and board columns. */
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
  /** Called when a row attribute changes through drag/drop, board movement, or inline controls. */
  onAttributeChange?: (rowId: string, attributeId: string, value: unknown) => Promise<void> | void;
  /** Called for manual row ordering when a dragged row is dropped before another row. */
  onReorder?: (rowId: string, beforeRowId?: string) => Promise<void> | void;
  createRow?: DataRendererCreateRowConfig;
  onCreateRow?: (submission: DataRendererCreateSubmission) => Promise<void> | void;
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
  onAttributeChange?: (rowId: string, attributeId: string, value: unknown) => Promise<void> | void;
  onReorder?: (rowId: string, beforeRowId?: string) => Promise<void> | void;
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
    onBadgeChange: onAttributeChange
      ? (attributeId: string, value: unknown) => onAttributeChange(row.id, attributeId, value)
      : undefined,
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
    createRow,
    onCreateRow,
    onColumnAction,
    getBoardColumnConfig,
    getRowContextMenuActions,
    hideToolbar = false,
    toolbarLeading,
  } = props;

  const attributes = useResolvedAttributes(rawAttributes);
  const [createColumnId, setCreateColumnId] = useState<string | null>(null);
  const initialState = { settings: defaultSettings, filters: defaultFilters };
  const settings = useDataRendererStore(storageKey, (state) => state.settings, initialState);
  const filters = useDataRendererStore(storageKey, (state) => state.filters, initialState);
  const expandedGroups = useDataRendererStore(storageKey, (state) => state.expandedGroups, initialState);
  const setExpandedGroup = useDataRendererStore(storageKey, (state) => state.setExpandedGroup, initialState);

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
        onBadgeChange: onAttributeChange
          ? (attributeId: string, value: unknown) => onAttributeChange(row.id, attributeId, value)
          : undefined,
        onClick: () => onRowClick?.(row as TRow),
      },
    }));

  const columnGroupingDescriptor = findAttribute(attributes, settings.columnGrouping);

  const boardColumns: DataRendererBoardColumn[] = grouped.map((column) => {
    const columnConfig = getBoardColumnConfig?.(column.key) ?? {};
    const orderedRows = orderRows(column.rows, settings.ordering, attributes);
    // Column color follows the enum option when the contribution does not
    // provide one, while row display badges stay visually neutral.
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

  const handleBoardMoveItem = async (
    rowId: string,
    targetColumnId: string,
    context?: { beforeItemId?: string; targetGroupKey?: string },
  ) => {
    await applyBoardMoveItem({
      settings,
      rowId,
      targetColumnId,
      targetGroupKey: context?.targetGroupKey,
      beforeItemId: context?.beforeItemId,
      onAttributeChange,
      onReorder,
    });
  };

  const handleBoardMoveToGroup = async (rowId: string, targetGroupKey: string, context?: { beforeItemId?: string }) => {
    await applyBoardMoveToGroup({
      settings,
      rowId,
      targetGroupKey,
      beforeItemId: context?.beforeItemId,
      onAttributeChange,
      onReorder,
    });
  };

  return (
    <Stack height="100%" minH="0" gap="0">
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
        listExpandedGroups={expandedGroups}
        selectedRowId={selectedRowId}
        emptyState={emptyState}
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
        onBoardMoveItem={handleBoardMoveItem}
        onBoardMoveToGroup={handleBoardMoveToGroup}
        onCreateRow={createRow && onCreateRow ? setCreateColumnId : undefined}
        onColumnAction={onColumnAction}
        onListExpandedGroupChange={setExpandedGroup}
        listKey={`${settings.columnGrouping}:${settings.rowGrouping}`}
      />
      {createRow && onCreateRow && createColumnId ? (
        <DataRendererCreateDialog
          open
          columnId={createColumnId}
          columnAttributeId={settings.columnGrouping === NO_GROUPING ? undefined : settings.columnGrouping}
          attributes={attributes}
          config={createRow}
          onClose={() => setCreateColumnId(null)}
          onSubmit={onCreateRow}
        />
      ) : null}
    </Stack>
  );
};
