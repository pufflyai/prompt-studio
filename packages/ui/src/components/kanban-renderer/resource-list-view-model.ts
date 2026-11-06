import type { ViewFilterGroup, ViewSort } from "@pstdio/sdk/extensions";
import { Circle } from "lucide-react";
import type { CollectionPageControl } from "../collection-view/collection-page";
import { withTitleField } from "../collection-view/collection-view-fields";
import { sortRowsByView } from "../collection-view/collection-view-sort";
import type { ResourceContextAction } from "../overlays/resource-context-menu";
import { getIconComponent } from "../primitives/icon-options";
import { type KanbanActionErrorHandler, runKanbanAction } from "./kanban-renderer-action";
import { narrowKanbanRows } from "./kanban-renderer-board-columns";
import { groupRows } from "./kanban-renderer-grouping";
import { collectDisplayBadges, collectDisplayCustomSlots, findEnumOption } from "./kanban-renderer-helpers";
import type { KanbanRendererListItem } from "./kanban-renderer-list";
import { applyKanbanPageCounts } from "./kanban-renderer-page";
import {
  type AttributeDescriptor,
  DEFAULT_KANBAN_RENDERER_SETTINGS,
  type KanbanRendererRow,
  type KanbanRendererSettings,
} from "./types";

/** Persisted or shared views cannot turn a resource list into a board. */
export const resourceListSettings = (settings: Partial<KanbanRendererSettings>): KanbanRendererSettings => ({
  ...DEFAULT_KANBAN_RENDERER_SETTINGS,
  showChildren: true,
  ...settings,
  viewMode: "list",
  rowGrouping: "none",
});

interface ResourceListItemsInput {
  page?: CollectionPageControl;
  rows: KanbanRendererRow[];
  attributes: AttributeDescriptor[];
  settings: KanbanRendererSettings;
  filter: ViewFilterGroup;
  sorts: ViewSort[];
  search: string;
  onAttributeChange?: (rowId: string, attributeId: string, value: unknown) => Promise<void> | void;
  onActionError?: KanbanActionErrorHandler;
  onRowClick?: (row: KanbanRendererRow) => void;
  getRowContextMenuActions?: (row: KanbanRendererRow) => ResourceContextAction[];
  onCreate?: (groupKey: string) => void;
}

// List identities have separate namespaces; callbacks retain the provider resource ID.
export const resourceListRowId = (id: string) => JSON.stringify(["resource", id]);

/** Group headers and nested children are not parent-resource results. */
export const countResourceListRows = (items: KanbanRendererListItem[]) =>
  items.reduce((total, item) => total + (item.isGroup ? (item.children?.length ?? 0) : 1), 0);

export const buildResourceListItems = (input: ResourceListItemsInput): KanbanRendererListItem[] => {
  const { rows, attributes, filter, sorts, search, onRowClick, getRowContextMenuActions, onCreate } = input;
  const settings = resourceListSettings(input.settings);
  const fields = withTitleField(attributes);
  const { visibleRows } = narrowKanbanRows({
    rows,
    attributes,
    fields,
    settings,
    filter,
    search,
    providerFiltered: Boolean(input.page),
  });
  const properties = settings.displayProperties.filter((property) => property !== "id");
  const sorted = (values: KanbanRendererRow[]) => (input.page ? values : sortRowsByView(values, sorts, fields));
  const rowItem = (row: KanbanRendererRow, child = false): KanbanRendererListItem => ({
    id: resourceListRowId(row.id),
    title: row.title,
    expandOnClick: false,
    eyebrow: typeof row.attributes.id === "string" ? row.attributes.id : undefined,
    highlight: search,
    statusIcon: getIconComponent(row.icon),
    badges: collectDisplayBadges(row, attributes, properties),
    customSlots: collectDisplayCustomSlots(row, attributes, properties),
    onBadgeChange: input.onAttributeChange
      ? (attributeId, value) =>
          runKanbanAction(
            "Update attribute",
            () => input.onAttributeChange!(row.id, attributeId, value),
            input.onActionError,
          )
      : undefined,
    onClick: onRowClick ? () => onRowClick(row) : undefined,
    contextMenuActions: getRowContextMenuActions?.(row),
    children:
      !child && settings.showChildren !== false
        ? sorted(row.children ?? []).map((row) => rowItem(row, true))
        : undefined,
  });
  if (settings.columnGrouping === "none") return sorted(visibleRows).map((row) => rowItem(row));
  const field = attributes.find((field) => field.id === settings.columnGrouping);
  const grouped = groupRows(visibleRows, {
    attributes,
    columnGrouping: settings.columnGrouping,
    rowGrouping: "none",
    structureRows: rows,
  });
  return applyKanbanPageCounts(
    grouped,
    input.page?.result?.groups,
    attributes,
    settings,
    input.page?.result?.filteredTotal,
  ).map((group) => {
    const option = field ? findEnumOption(field.type, group.key) : undefined;
    return {
      id: JSON.stringify(["group", group.key]),
      title: group.label,
      isGroup: true,
      countBadge: group.count ?? group.rows.length,
      statusIcon: Circle,
      statusColorPalette: option?.color,
      note: option?.note,
      onNoteClick: option?.onNoteClick,
      onCreate: option?.canCreate && onCreate ? () => onCreate(group.key) : undefined,
      children: sorted(group.rows).map((row) => rowItem(row)),
    };
  });
};
