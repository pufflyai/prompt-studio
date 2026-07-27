import { Stack } from "@chakra-ui/react";
import { type ReactNode, useState } from "react";

import type { ResourceContextAction } from "@/components/overlays/resource-context-menu";
import type {
  KanbanRendererBoardColumn,
  KanbanRendererBoardColumnAction,
  KanbanRendererBoardGroup,
} from "./kanban-renderer-board";
import { applyBoardMoveItem, applyBoardMoveToGroup } from "./kanban-renderer-board-move";
import { KanbanRendererContent } from "./kanban-renderer-content";
import { KanbanRendererCreateDialog } from "./kanban-renderer-create-dialog";
import { filterRows, groupRows, orderRows } from "./kanban-renderer-grouping";
import {
  collectDisplayBadges,
  collectDisplayCustomSlots,
  findEnumOption,
  resolveKnownColumnKeys,
} from "./kanban-renderer-helpers";
import { buildKanbanRendererListItems } from "./kanban-renderer-list-items";
import { KanbanRendererToolbar } from "./kanban-renderer-toolbar";
import type {
  AttributeDescriptor,
  KanbanRendererCreateRowConfig,
  KanbanRendererCreateSubmission,
  KanbanRendererFilterState,
  KanbanRendererRow,
  KanbanRendererSavedView,
  KanbanRendererSettings,
} from "./types";
import { findAttribute, NO_GROUPING } from "./types";
import { useKanbanRendererStore } from "./use-kanban-renderer-store";
import { useResolvedAttributes } from "./use-resolved-attributes";

/** Board-column behavior and menu configuration for a resolved column group. */
export interface BoardColumnConfig {
  /** Chakra color palette used for the column header and group badges. */
  color?: string;
  canDragIn?: boolean;
  canDragOut?: boolean;
  canCreate?: boolean;
  actions?: KanbanRendererBoardColumnAction[];
}

/** Switchable list/board renderer for rows with typed attributes, filtering, grouping, and ordering. */
export interface KanbanRendererProps<TRow extends KanbanRendererRow = KanbanRendererRow> {
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
  defaultSettings?: Partial<KanbanRendererSettings>;
  defaultFilters?: KanbanRendererFilterState;
  defaultViews?: KanbanRendererSavedView[];
  defaultActiveViewId?: string;
  hideToolbar?: boolean;
  toolbarLeading?: ReactNode;
  onRowClick?: (row: TRow) => void;
  /** Called when a row attribute changes through drag/drop, board movement, or inline controls. */
  onAttributeChange?: (rowId: string, attributeId: string, value: unknown) => Promise<void> | void;
  /** Called for manual row ordering when a dragged row is dropped before another row. */
  onReorder?: (rowId: string, beforeRowId?: string) => Promise<void> | void;
  createRow?: KanbanRendererCreateRowConfig;
  onCreateRow?: (submission: KanbanRendererCreateSubmission) => Promise<void> | void;
  onColumnAction?: (columnId: string, actionId: string) => Promise<void> | void;
  getBoardColumnConfig?: (groupKey: string) => BoardColumnConfig;
  getRowContextMenuActions?: (row: TRow) => ResourceContextAction[];
}

const rowEyebrow = (row: KanbanRendererRow) => {
  const shorthand = row.attributes.id;
  return typeof shorthand === "string" && shorthand ? shorthand : row.id;
};

export const KanbanRenderer = <TRow extends KanbanRendererRow>(props: KanbanRendererProps<TRow>) => {
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
    defaultViews,
    defaultActiveViewId,
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
  const initialState = {
    settings: defaultSettings,
    filters: defaultFilters,
    views: defaultViews,
    activeViewId: defaultActiveViewId,
  };
  const settings = useKanbanRendererStore(storageKey, (state) => state.settings, initialState);
  const filters = useKanbanRendererStore(storageKey, (state) => state.filters, initialState);
  const expandedGroups = useKanbanRendererStore(storageKey, (state) => state.expandedGroups, initialState);
  const setExpandedGroup = useKanbanRendererStore(storageKey, (state) => state.setExpandedGroup, initialState);

  const visibleRows = filterRows(rows, filters, attributes) as TRow[];

  const knownColumnKeys = resolveKnownColumnKeys(settings.columnGrouping, attributes, filters);

  const grouped = groupRows(visibleRows, {
    attributes,
    columnGrouping: settings.columnGrouping,
    rowGrouping: settings.rowGrouping,
    knownColumnKeys,
  });

  const listItems = buildKanbanRendererListItems({
    settings,
    visibleRows,
    grouped,
    attributes,
    onRowClick,
    onAttributeChange,
    onReorder,
    getRowContextMenuActions,
  });

  const cardDisplayProperties = settings.displayProperties.filter((property) => property !== "id");
  const toBoardItems = (boardRows: KanbanRendererRow[]) =>
    boardRows.map((row) => ({
      id: row.id,
      contextMenuActions: getRowContextMenuActions?.(row as TRow),
      cardProps: {
        eyebrow: settings.displayProperties.includes("id") ? rowEyebrow(row) : undefined,
        title: row.title,
        badges: collectDisplayBadges(row, attributes, cardDisplayProperties),
        customSlots: collectDisplayCustomSlots(row, attributes, cardDisplayProperties),
        onBadgeChange: onAttributeChange
          ? (attributeId: string, value: unknown) => onAttributeChange(row.id, attributeId, value)
          : undefined,
        onClick: () => onRowClick?.(row as TRow),
      },
    }));

  const columnGroupingDescriptor = findAttribute(attributes, settings.columnGrouping);

  const boardColumns: KanbanRendererBoardColumn[] = grouped.map((column) => {
    const columnConfig = getBoardColumnConfig?.(column.key) ?? {};
    const orderedRows = orderRows(column.rows, settings.ordering, attributes);
    // Column color follows the enum option when the contribution does not
    // provide one, while row display badges stay visually neutral.
    const enumOption = columnGroupingDescriptor ? findEnumOption(columnGroupingDescriptor.type, column.key) : undefined;

    const groups: KanbanRendererBoardGroup[] | undefined =
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
      color: columnConfig.color ?? enumOption?.color,
      icon: enumOption?.icon ?? "circle",
      canDragIn: columnConfig.canDragIn ?? false,
      canDragOut: columnConfig.canDragOut ?? false,
      canCreate: columnConfig.canCreate ?? false,
      actions: columnConfig.actions ?? [],
      items: toBoardItems(orderedRows),
      groups,
    } satisfies KanbanRendererBoardColumn;
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
    <Stack data-testid="kanban-renderer" height="100%" minH="0" gap="0" background="bg" overflow="hidden">
      {hideToolbar ? null : (
        <KanbanRendererToolbar
          rows={rows}
          storageKey={storageKey}
          attributes={attributes}
          defaultSettings={defaultSettings}
          defaultFilters={defaultFilters}
          defaultViews={defaultViews}
          defaultActiveViewId={defaultActiveViewId}
          leading={toolbarLeading}
        />
      )}

      <KanbanRendererContent
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
        <KanbanRendererCreateDialog
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
