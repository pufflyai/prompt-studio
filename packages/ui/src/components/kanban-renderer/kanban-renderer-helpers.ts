import { createElement, type ReactNode } from "react";
import { CollectionBadge } from "./collection-badge";
import type { AttributeBadge } from "./kanban-renderer-badge-helpers";
import { renderEnumBadge, renderMultiEnumBadge } from "./kanban-renderer-badge-helpers";
import { getEnumOptions, toTitleCase } from "./kanban-renderer-enum-helpers";
import type {
  AttributeDescriptor,
  CollectionBadgeItem,
  KanbanRendererFilterState,
  KanbanRendererRow,
  KanbanRendererSettings,
} from "./types";
import { findAttribute, MANUAL_ORDERING, NO_GROUPING } from "./types";

export type { AttributeBadge } from "./kanban-renderer-badge-helpers";
export { getAttributeBadgeColorPalette } from "./kanban-renderer-badge-helpers";
export { enumOptionLabel, findEnumOption, getEnumOptions, toTitleCase } from "./kanban-renderer-enum-helpers";

/**
 * Read a typed attribute value out of a row. enum-multi normalizes to an array;
 * single-valued kinds normalize to undefined when missing.
 */
export const getAttributeValue = (row: KanbanRendererRow, descriptor: AttributeDescriptor) => {
  const raw = row.attributes[descriptor.id];
  if (descriptor.type.kind === "enum-multi") {
    if (Array.isArray(raw)) return raw.filter((entry): entry is string => typeof entry === "string");
    return [] as string[];
  }
  return raw;
};

export const getAttributeStringValues = (row: KanbanRendererRow, descriptor: AttributeDescriptor): string[] => {
  const value = getAttributeValue(row, descriptor);
  if (descriptor.type.kind === "enum-multi") return value as string[];
  if (value === null || value === undefined) return [];
  if (typeof value === "string") return value === "" ? [] : [value];
  if (typeof value === "number") return [String(value)];
  return [];
};

const formatDateValue = (value: unknown) => {
  if (typeof value !== "string" || value === "") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString();
};

const formatNumberValue = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string" && value !== "" && !Number.isNaN(Number(value))) return value;
  return null;
};

const formatStringValue = (value: unknown) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value === "" ? null : value;
  return String(value);
};

const formatUserValue = (value: unknown) => formatStringValue(value);

const isRenderableNode = (value: unknown) => value !== null && value !== undefined && value !== false;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const textValue = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : undefined);

const isCollectionResource = (value: unknown): value is NonNullable<CollectionBadgeItem["resource"]> =>
  isRecord(value) && typeof value.type === "string" && typeof value.id === "string";

const normalizeCollectionBadgeItems = (value: unknown): CollectionBadgeItem[] => {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const id = textValue(item.id);
    if (!id) return [];
    const label = textValue(item.label) ?? id;
    const icon = textValue(item.icon);
    const resource = isCollectionResource(item.resource) ? item.resource : undefined;
    return [{ id, label, ...(icon ? { icon } : {}), ...(resource ? { resource } : {}) }];
  });
};

export const renderBadgeListDisplay = (
  descriptor: AttributeDescriptor,
  value: unknown,
  row: KanbanRendererRow,
  openResource?: (resource: NonNullable<CollectionBadgeItem["resource"]>) => void,
): ReactNode => {
  if (descriptor.display?.kind !== "badge-list") return null;
  const items = normalizeCollectionBadgeItems(row.attributes[descriptor.display.itemsAttributeId]);
  if (items.length === 0) return null;

  const selectedId = typeof value === "string" ? value : undefined;
  const selectedItem = items.find((item) => item.id === selectedId) ?? items[0];
  if (!selectedItem) return null;

  const orderedItems = [selectedItem, ...items.filter((item) => item.id !== selectedItem.id)];
  return orderedItems.map((item) =>
    createElement(CollectionBadge, {
      key: item.id,
      label: item.label,
      icon: item.icon,
      onClick: item.resource && openResource ? () => openResource(item.resource!) : undefined,
    }),
  );
};

/**
 * Per-type default cell summary used by the card / list end-content. Returns
 * null when the attribute has no displayable value.
 */
export const renderAttributeBadge = (
  descriptor: AttributeDescriptor,
  row: KanbanRendererRow,
): AttributeBadge | null => {
  const type = descriptor.type;
  const value = getAttributeValue(row, descriptor);

  if (descriptor.render || descriptor.display) return null;

  if (type.kind === "enum") return renderEnumBadge(descriptor, type, value);
  if (type.kind === "enum-multi") return renderMultiEnumBadge(descriptor, type, value);

  if (type.kind === "date") {
    const formatted = formatDateValue(value);
    return formatted ? { attributeId: descriptor.id, label: formatted } : null;
  }

  if (type.kind === "number") {
    const formatted = formatNumberValue(value);
    return formatted ? { attributeId: descriptor.id, label: formatted } : null;
  }

  if (type.kind === "user") {
    const formatted = formatUserValue(value);
    return formatted ? { attributeId: descriptor.id, label: formatted, color: "blue" } : null;
  }

  const formatted = formatStringValue(value);
  return formatted ? { attributeId: descriptor.id, label: formatted } : null;
};

export const collectDisplayBadges = (
  row: KanbanRendererRow,
  attributes: AttributeDescriptor[],
  displayProperties: string[],
): AttributeBadge[] => {
  const badges: AttributeBadge[] = [];
  for (const id of displayProperties) {
    const descriptor = findAttribute(attributes, id);
    if (!descriptor || descriptor.displayable === false) continue;
    const badge = renderAttributeBadge(descriptor, row);
    if (badge) badges.push(badge);
  }
  return badges;
};

export const collectDisplayCustomSlots = (
  row: KanbanRendererRow,
  attributes: AttributeDescriptor[],
  displayProperties: string[],
): ReactNode[] => {
  const slots: ReactNode[] = [];
  for (const id of displayProperties) {
    const descriptor = findAttribute(attributes, id);
    if (!descriptor || descriptor.displayable === false) continue;

    const value = getAttributeValue(row, descriptor);
    const slot = descriptor.render ? descriptor.render(value, row) : renderBadgeListDisplay(descriptor, value, row);
    if (isRenderableNode(slot)) slots.push(slot);
  }
  return slots;
};

const collectValuesFromRows = (rows: KanbanRendererRow[], descriptor: AttributeDescriptor) => {
  const values = new Set<string>();
  for (const row of rows) {
    for (const value of getAttributeStringValues(row, descriptor)) values.add(value);
  }
  return values;
};

export interface FilterCategoryView {
  id: string;
  label: string;
  selectionMode: "multiple";
  options: { value: string; label: string; color?: string }[];
}

/**
 * Build the filter menu's category list from the declared attributes. Enum
 * descriptors expose their declared options first; auto-derived values from
 * the data fill in the gaps for string / date / number / user attributes (so
 * filter chips for free-form fields don't require declaring every option).
 */
export const buildFilterCategories = (
  attributes: AttributeDescriptor[],
  rows: KanbanRendererRow[],
): FilterCategoryView[] => {
  const categories: FilterCategoryView[] = [];
  for (const descriptor of attributes) {
    if (!descriptor.filterable) continue;

    if (descriptor.type.kind === "enum" || descriptor.type.kind === "enum-multi") {
      const declared = getEnumOptions(descriptor.type);
      const auto = collectValuesFromRows(rows, descriptor);
      const declaredValues = new Set(declared.map((option) => option.value));
      const undeclared = [...auto]
        .filter((value) => !declaredValues.has(value))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
        .map((value) => ({ value, label: toTitleCase(value) }));

      categories.push({
        id: descriptor.id,
        label: descriptor.label,
        selectionMode: "multiple",
        options: [
          ...declared.map((option) => ({ value: option.value, label: option.label, color: option.color })),
          ...undeclared,
        ],
      });
      continue;
    }

    const auto = [...collectValuesFromRows(rows, descriptor)]
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .map((value) => ({ value, label: toTitleCase(value) }));
    categories.push({ id: descriptor.id, label: descriptor.label, selectionMode: "multiple", options: auto });
  }
  return categories;
};

export interface MenuOption {
  value: string;
  label: string;
}

export const buildGroupingOptions = (attributes: AttributeDescriptor[]): MenuOption[] => {
  const options: MenuOption[] = [{ value: NO_GROUPING, label: "None" }];
  for (const descriptor of attributes) {
    if (!descriptor.groupable) continue;
    // enum-multi is intentionally not offered for grouping (one row can hold
    // multiple values; we don't double-render).
    if (descriptor.type.kind === "enum-multi") continue;
    options.push({ value: descriptor.id, label: descriptor.label });
  }
  return options;
};

export const buildOrderingOptions = (attributes: AttributeDescriptor[]): MenuOption[] => {
  const options: MenuOption[] = [{ value: MANUAL_ORDERING, label: "Manual" }];
  options.push({ value: "title", label: "Title" });
  for (const descriptor of attributes) {
    if (!descriptor.sortable) continue;
    options.push({ value: descriptor.id, label: descriptor.label });
  }
  return options;
};

export const buildDisplayPropertyOptions = (attributes: AttributeDescriptor[]): MenuOption[] => {
  const options: MenuOption[] = [];
  for (const descriptor of attributes) {
    if (!descriptor.displayable) continue;
    options.push({ value: descriptor.id, label: descriptor.label });
  }
  return options;
};

export const resolveSubGroupingOptions = (options: MenuOption[], columnGrouping: string) => {
  if (columnGrouping === NO_GROUPING) return options.filter((option) => option.value === NO_GROUPING);
  return options.filter((option) => option.value === NO_GROUPING || option.value !== columnGrouping);
};

export const resolveListDropTargetColumnKey = (columnGrouping: string, placement?: { columnKey?: string }) => {
  if (columnGrouping === NO_GROUPING) return "all";
  return placement?.columnKey;
};

export const resolveKnownColumnKeys = (
  columnGrouping: string,
  attributes: AttributeDescriptor[],
  filters?: KanbanRendererFilterState,
) => {
  if (columnGrouping === NO_GROUPING) return undefined;
  const descriptor = findAttribute(attributes, columnGrouping);
  const active = filters?.[columnGrouping];
  if (descriptor && active && active.length > 0) return normalizeFilterValues(descriptor, active);
  if (!descriptor) return undefined;
  if (descriptor.type.kind === "enum") return getEnumOptions(descriptor.type).map((option) => option.value);
  return undefined;
};

export const normalizeFilterValues = (_descriptor: AttributeDescriptor, values: string[]) => values;

export const omitFilterCategory = (filters: KanbanRendererFilterState, id: string): KanbanRendererFilterState => {
  const next = { ...filters };
  delete next[id];
  return next;
};

/**
 * Drop persisted settings entries that reference attribute ids no longer
 * declared by the contribution. Falls back to defaults for missing grouping
 * and ordering attributes so a stale saved view still loads cleanly.
 */
export const sanitizeSettings = (
  settings: KanbanRendererSettings,
  attributes: AttributeDescriptor[],
): KanbanRendererSettings => {
  const knownIds = new Set(attributes.map((attribute) => attribute.id));
  const validGroupingId = (id: string) => id === NO_GROUPING || knownIds.has(id);
  const validOrderingId = (id: string) => id === MANUAL_ORDERING || id === "title" || knownIds.has(id);

  const columnGrouping = validGroupingId(settings.columnGrouping) ? settings.columnGrouping : NO_GROUPING;
  const rowGrouping = validGroupingId(settings.rowGrouping) ? settings.rowGrouping : NO_GROUPING;
  const orderingId = validOrderingId(settings.ordering.attributeId) ? settings.ordering.attributeId : MANUAL_ORDERING;
  const displayProperties = settings.displayProperties.filter(validGroupingId);

  return {
    viewMode: settings.viewMode,
    columnGrouping,
    rowGrouping,
    ordering: { attributeId: orderingId, direction: settings.ordering.direction },
    displayProperties,
  };
};

export const sanitizeFilters = (filters: KanbanRendererFilterState, attributes: AttributeDescriptor[]) => {
  const attributesById = new Map(attributes.map((attribute) => [attribute.id, attribute]));
  const next: KanbanRendererFilterState = {};
  for (const [id, values] of Object.entries(filters)) {
    const descriptor = attributesById.get(id);
    if (!descriptor) continue;
    if (!values || values.length === 0) continue;
    next[id] = normalizeFilterValues(descriptor, values);
  }
  return next;
};
