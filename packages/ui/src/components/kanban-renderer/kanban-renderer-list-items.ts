import type { ResourceContextAction } from "@/components/overlays/resource-context-menu";
import { type KanbanRendererColumnGroup, orderRows } from "./kanban-renderer-grouping";
import {
  collectDisplayBadges,
  collectDisplayCustomSlots,
  findEnumOption,
  resolveListDropTargetColumnKey,
} from "./kanban-renderer-helpers";
import type { KanbanRendererListItem } from "./kanban-renderer-list";
import type { AttributeDescriptor, KanbanRendererRow, KanbanRendererSettings } from "./types";
import { findAttribute, MANUAL_ORDERING, NO_GROUPING } from "./types";

interface BuildKanbanRendererListItemsInput<TRow extends KanbanRendererRow> {
  settings: KanbanRendererSettings;
  visibleRows: TRow[];
  grouped: KanbanRendererColumnGroup[];
  attributes: AttributeDescriptor[];
  onRowClick?: (row: TRow) => void;
  onAttributeChange?: (rowId: string, attributeId: string, value: unknown) => Promise<void> | void;
  onReorder?: (rowId: string, beforeRowId?: string) => Promise<void> | void;
  getRowContextMenuActions?: (row: TRow) => ResourceContextAction[];
}

export const buildKanbanRendererListItems = <TRow extends KanbanRendererRow>(
  input: BuildKanbanRendererListItemsInput<TRow>,
) => {
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

  const toListItem = (row: TRow, placement?: { columnKey?: string; rowKey?: string }): KanbanRendererListItem => ({
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

  const toGroupListItem = (
    group: { key: string; label: string; rows: KanbanRendererRow[] },
    parent?: { columnKey: string },
  ): KanbanRendererListItem => ({
    id: parent ? `group::${parent.columnKey}::${group.key}` : `group::${group.key}`,
    title: group.label,
    isGroup: true,
    countBadge: group.rows.length,
    countColorPalette: getGroupColorPalette(parent ? settings.rowGrouping : settings.columnGrouping, group.key),
    onDropRow:
      onAttributeChange && settings.columnGrouping !== NO_GROUPING
        ? (draggedId) => {
            const columnKey = parent?.columnKey ?? group.key;
            onAttributeChange(draggedId, settings.columnGrouping, columnKey);
            if (settings.rowGrouping !== NO_GROUPING && parent) {
              onAttributeChange(draggedId, settings.rowGrouping, group.key);
            }
          }
        : undefined,
    children: orderRows(group.rows, settings.ordering, attributes).map((row) =>
      toListItem(row as TRow, {
        columnKey: parent?.columnKey ?? group.key,
        rowKey: parent ? group.key : undefined,
      }),
    ),
  });

  if (settings.columnGrouping === NO_GROUPING) {
    return orderRows(visibleRows, settings.ordering, attributes).map((row) => toListItem(row as TRow));
  }

  return grouped.map((column) =>
    column.subgroups.length > 0
      ? {
          id: `group::${column.key}`,
          title: column.label,
          isGroup: true,
          countBadge: column.rows.length,
          countColorPalette: getGroupColorPalette(settings.columnGrouping, column.key),
          onDropRow: onAttributeChange
            ? (draggedId: string) => onAttributeChange(draggedId, settings.columnGrouping, column.key)
            : undefined,
          children: column.subgroups.map((group) => toGroupListItem(group, { columnKey: column.key })),
        }
      : toGroupListItem(column),
  );
};
