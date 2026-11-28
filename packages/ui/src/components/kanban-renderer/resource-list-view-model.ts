import type { ViewFilterGroup, ViewSort } from "@pstdio/sdk/extensions";
import { normalizeSubGroupings } from "pstdio-api-contracts/collections";
import type { CollectionPageControl } from "../collection-view/collection-page";
import { withTitleField } from "../collection-view/collection-view-fields";
import { groupRowsByField } from "../collection-view/collection-view-grouping";
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
  findAttribute,
  type KanbanRendererRow,
  type KanbanRendererSettings,
} from "./types";

/** Persisted or shared views cannot turn a resource list into a board, or sub-group without a grouping. */
export const resourceListSettings = (settings: Partial<KanbanRendererSettings>): KanbanRendererSettings => {
  const merged = { ...DEFAULT_KANBAN_RENDERER_SETTINGS, showChildren: true, ...settings };
  const subGroupings = normalizeSubGroupings(merged.columnGrouping, merged.subGroupings);
  return { ...merged, viewMode: "list", rowGrouping: "none", subGroupings };
};

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
export const countResourceListRows = (items: KanbanRendererListItem[]): number =>
  items.reduce((total, item) => total + (item.isGroup ? countResourceListRows(item.children ?? []) : 1), 0);

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
  const rowItem = (row: KanbanRendererRow): KanbanRendererListItem => ({
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
    children: settings.showChildren !== false ? sorted(row.children ?? []).map(rowItem) : undefined,
  });
  if (settings.columnGrouping === "none") return sorted(visibleRows).map((row) => rowItem(row));
  const field = attributes.find((field) => field.id === settings.columnGrouping);
  const subFields = (settings.subGroupings ?? []).flatMap((id) => findAttribute(attributes, id) ?? []);
  // Sub-groups are built from the loaded rows, one field per level; empty sub-groups are left out.
  const nest = (path: string[], groupRows: KanbanRendererRow[], level: number): KanbanRendererListItem[] => {
    const subField = subFields[level];
    if (!subField) return sorted(groupRows).map(rowItem);
    return groupRowsByField(groupRows, subField)
      .filter((subgroup) => subgroup.rows.length > 0)
      .map((subgroup) =>
        resourceListGroupItem({
          path: [...path, subgroup.key],
          group: subgroup,
          field: subField,
          children: nest([...path, subgroup.key], subgroup.rows, level + 1),
        }),
      );
  };
  const grouped = groupRows(visibleRows, {
    attributes,
    columnGrouping: settings.columnGrouping,
    rowGrouping: "none",
    structureRows: rows,
  });
  const hasPageGroupCounts = input.page?.result?.groups.some(
    (group) => !group.parent && group.field === settings.columnGrouping,
  );
  return applyKanbanPageCounts(
    grouped,
    input.page?.result?.groups,
    attributes,
    settings,
    input.page?.result?.filteredTotal,
  ).map((group) =>
    resourceListGroupItem({
      path: [group.key],
      group,
      field,
      remainingRows:
        hasPageGroupCounts && group.count !== undefined ? Math.max(0, group.count - group.rows.length) : undefined,
      children: nest([group.key], group.rows, 0),
      onCreate: onCreate ? () => onCreate(group.key) : undefined,
    }),
  );
};

interface ResourceListGroupItemInput {
  /** Group keys from the outermost level, so sub-groups stay distinct across parents. */
  path: string[];
  group: { key: string; label: string; rows: KanbanRendererRow[]; count?: number };
  field: AttributeDescriptor | undefined;
  remainingRows?: number;
  children: KanbanRendererListItem[];
  onCreate?: () => void;
}

const resourceListGroupItem = (input: ResourceListGroupItemInput): KanbanRendererListItem => {
  const { path, group, field, children, remainingRows } = input;
  const option = field ? findEnumOption(field.type, group.key) : undefined;
  return {
    id: JSON.stringify(["group", ...path]),
    title: group.label,
    isGroup: true,
    countBadge: group.count ?? group.rows.length,
    remainingRows,
    statusIcon: getIconComponent(option?.icon),
    statusColorPalette: option?.color,
    note: option?.note,
    onNoteClick: option?.onNoteClick,
    onCreate: option?.canCreate ? input.onCreate : undefined,
    contextMenuActions: option?.contextMenuActions?.map((action) => ({
      key: action.id,
      label: action.label,
      isDisabled: action.disabled,
      onClick: action.onAction,
    })),
    children,
  };
};
