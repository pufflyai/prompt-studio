import type { ViewFilterGroup, ViewSort } from "@pstdio/sdk/extensions";
import type { ResourceContextAction } from "@/components/overlays/resource-context-menu";
import { findField, formatFieldText } from "../collection-view/collection-view-fields";
import { filterRowsByView } from "../collection-view/collection-view-filter";
import { groupKey } from "../collection-view/collection-view-grouping";
import { searchRows } from "../collection-view/collection-view-search";
import { sortRowsByView } from "../collection-view/collection-view-sort";
import type { BoardColumnConfig } from "./kanban-renderer";
import type { KanbanRendererBoardColumn, KanbanRendererBoardGroup } from "./kanban-renderer-board";
import type { KanbanRendererColumnGroup } from "./kanban-renderer-grouping";
import { collectDisplayBadges, collectDisplayCustomSlots, findEnumOption } from "./kanban-renderer-helpers";
import { type AttributeDescriptor, findAttribute, type KanbanRendererRow, type KanbanRendererSettings } from "./types";

export const rowEyebrow = (row: KanbanRendererRow) => {
  const shorthand = row.attributes.id;
  return typeof shorthand === "string" && shorthand ? shorthand : row.id;
};

interface NarrowKanbanRowsInput<TRow extends KanbanRendererRow> {
  rows: TRow[];
  filter: ViewFilterGroup;
  fields: AttributeDescriptor[];
  attributes: AttributeDescriptor[];
  settings: KanbanRendererSettings;
  search: string;
}

/** Applies the view's filter, then the search, and counts each column before search narrowed it. */
export const narrowKanbanRows = <TRow extends KanbanRendererRow>(input: NarrowKanbanRowsInput<TRow>) => {
  const { rows, filter, fields, attributes, settings, search } = input;
  const displayProperties = settings.displayProperties.filter((property) => property !== "id");
  const showsId = settings.displayProperties.includes("id");
  // Search matches only what a card shows: its title, its id when shown, and its visible properties.
  const searchTexts = (row: KanbanRendererRow) => [
    row.title,
    ...(showsId ? [rowEyebrow(row)] : []),
    ...displayProperties.flatMap((id) => {
      const field = findField(attributes, id);
      return field ? formatFieldText(row, field) : [];
    }),
  ];
  const filteredRows = filterRowsByView(rows, filter, fields);
  const visibleRows = searchRows(filteredRows, search, searchTexts);
  const columnField = findAttribute(attributes, settings.columnGrouping);
  const columnTotals = new Map<string, number>();
  if (columnField)
    for (const row of filteredRows) {
      const key = groupKey(row, columnField);
      columnTotals.set(key, (columnTotals.get(key) ?? 0) + 1);
    }
  return { filteredRows, visibleRows, columnTotals };
};

interface BuildKanbanBoardColumnsInput<TRow extends KanbanRendererRow> {
  grouped: KanbanRendererColumnGroup[];
  settings: KanbanRendererSettings;
  sorts: ViewSort[];
  fields: AttributeDescriptor[];
  attributes: AttributeDescriptor[];
  search: string;
  /** Cards per column before search, set only while a search is active. */
  columnTotals?: Map<string, number>;
  getBoardColumnConfig?: (groupKey: string) => BoardColumnConfig;
  getRowContextMenuActions?: (row: TRow) => ResourceContextAction[];
  onAttributeChange?: (rowId: string, attributeId: string, value: unknown) => Promise<void> | void;
  onRowClick?: (row: TRow) => void;
}

/** Sorts order cards inside each column; columns keep the grouping field's order. */
export const buildKanbanBoardColumns = <TRow extends KanbanRendererRow>(input: BuildKanbanBoardColumnsInput<TRow>) => {
  const { grouped, settings, sorts, fields, attributes, search, columnTotals } = input;
  const { getBoardColumnConfig, getRowContextMenuActions, onAttributeChange, onRowClick } = input;
  const displayProperties = settings.displayProperties.filter((property) => property !== "id");
  const showsId = settings.displayProperties.includes("id");
  const columnField = findAttribute(attributes, settings.columnGrouping);
  const toBoardItems = (rows: KanbanRendererRow[]) =>
    sortRowsByView(rows, sorts, fields).map((row) => ({
      id: row.id,
      contextMenuActions: getRowContextMenuActions?.(row as TRow),
      cardProps: {
        eyebrow: showsId ? rowEyebrow(row) : undefined,
        title: row.title,
        highlight: search,
        badges: collectDisplayBadges(row, attributes, displayProperties),
        customSlots: collectDisplayCustomSlots(row, attributes, displayProperties),
        onBadgeChange: onAttributeChange
          ? (attributeId: string, value: unknown) => onAttributeChange(row.id, attributeId, value)
          : undefined,
        onClick: () => onRowClick?.(row as TRow),
      },
    }));

  return grouped.map((column): KanbanRendererBoardColumn => {
    const columnConfig = getBoardColumnConfig?.(column.key) ?? {};
    // Column color follows the enum option when the contribution does not
    // provide one, while row display badges stay visually neutral.
    const enumOption = columnField ? findEnumOption(columnField.type, column.key) : undefined;
    const groups: KanbanRendererBoardGroup[] | undefined =
      column.subgroups.length > 0
        ? column.subgroups.map((subgroup) => ({
            key: subgroup.key,
            label: subgroup.label,
            items: toBoardItems(subgroup.rows),
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
      items: toBoardItems(column.rows),
      groups,
      totalCount: columnTotals ? (columnTotals.get(column.key) ?? column.rows.length) : undefined,
    };
  });
};
