import type { ResourceContextAction } from "@/components/overlays/resource-context-menu";
import { getIconComponent } from "@/components/primitives/icon-options";
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
  const listDisplayProperties = settings.displayProperties.filter((property) => property !== "id");
  const getStatusPresentation = (attributeId: string, key: string) => {
    const descriptor = findAttribute(attributes, attributeId);
    const option = descriptor ? findEnumOption(descriptor.type, key) : undefined;
    return {
      statusColorPalette: option?.color,
      statusIcon: getIconComponent(option?.icon),
    };
  };
  const getRowStatusPresentation = (row: TRow) => {
    const status = row.attributes.status;
    if (typeof status !== "string") return {};
    return getStatusPresentation("status", status);
  };

  const toListItem = (row: TRow, placement?: { columnKey?: string; rowKey?: string }): KanbanRendererListItem => {
    const shorthand = typeof row.attributes.id === "string" ? row.attributes.id : undefined;

    return {
      id: row.id,
      eyebrow: shorthand && shorthand !== row.title ? shorthand : undefined,
      title: row.title,
      ...getRowStatusPresentation(row),
      badges: collectDisplayBadges(row, attributes, listDisplayProperties),
      customSlots: collectDisplayCustomSlots(row, attributes, listDisplayProperties),
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
    };
  };

  const toGroupListItem = (
    group: { key: string; label: string; rows: KanbanRendererRow[] },
    parent?: { columnKey: string },
  ): KanbanRendererListItem => {
    const groupingAttributeId = parent ? settings.rowGrouping : settings.columnGrouping;
    return {
      id: parent ? `group::${parent.columnKey}::${group.key}` : `group::${group.key}`,
      title: group.label,
      isGroup: true,
      countBadge: group.rows.length,
      ...getStatusPresentation(groupingAttributeId, group.key),
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
    };
  };

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
          ...getStatusPresentation(settings.columnGrouping, column.key),
          onDropRow: onAttributeChange
            ? (draggedId: string) => onAttributeChange(draggedId, settings.columnGrouping, column.key)
            : undefined,
          children: column.subgroups.map((group) => toGroupListItem(group, { columnKey: column.key })),
        }
      : toGroupListItem(column),
  );
};
