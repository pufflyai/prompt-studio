import type { ViewFilterGroup, ViewSort } from "@pstdio/sdk/extensions";
import type { ResourceContextAction } from "@/components/overlays/resource-context-menu";
import { findField, formatFieldText } from "../collection-view/collection-view-fields";
import { filterRowsByView } from "../collection-view/collection-view-filter";
import { searchRows } from "../collection-view/collection-view-search";
import { sortRowsByView } from "../collection-view/collection-view-sort";
import type { BoardColumnConfig } from "./kanban-renderer";
import type { KanbanRendererBoardColumn, KanbanRendererBoardGroup } from "./kanban-renderer-board";
import { groupRows, type KanbanRendererColumnGroup } from "./kanban-renderer-grouping";
import { collectDisplayBadges, collectDisplayCustomSlots, findEnumOption } from "./kanban-renderer-helpers";
import {
  type AttributeDescriptor,
  findAttribute,
  type KanbanRendererRow,
  type KanbanRendererSettings,
  NO_GROUPING,
} from "./types";

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
  // Lists always show a row's short id. Boards show an id only when it is a display property.
  const idTexts = (row: KanbanRendererRow) => {
    if (settings.viewMode === "list") return typeof row.attributes.id === "string" ? [row.attributes.id] : [];
    return showsId ? [rowEyebrow(row)] : [];
  };
  // Search matches only what a row shows: its title, its id when shown, and its visible properties.
  const searchTexts = (row: KanbanRendererRow) => [
    row.title,
    ...idTexts(row),
    ...displayProperties.flatMap((id) => {
      const field = findField(attributes, id);
      return field ? formatFieldText(row, field) : [];
    }),
  ];
  const filteredRows = filterRowsByView(rows, filter, fields);
  const visibleRows = searchRows(filteredRows, search, searchTexts);
  const columns = groupRows(filteredRows, {
    attributes,
    columnGrouping: settings.columnGrouping,
    rowGrouping: NO_GROUPING,
  });
  const columnTotals = new Map(columns.map((column) => [column.key, column.rows.length]));
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
      totalCount: columnTotals?.get(column.key),
    };
  });
};
