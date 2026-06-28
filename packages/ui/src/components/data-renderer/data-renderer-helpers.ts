import { createElement, type ReactNode } from "react";
import { WorkspaceBadge, type WorkspaceBadgeProps } from "../workspace-badge";
import type { AttributeBadge } from "./data-renderer-badge-helpers";
import { renderEnumBadge, renderMultiEnumBadge } from "./data-renderer-badge-helpers";
import { getEnumOptions, toTitleCase } from "./data-renderer-enum-helpers";
import type { AttributeDescriptor, DataRendererFilterState, DataRendererRow, DataRendererSettings } from "./types";
import { findAttribute, MANUAL_ORDERING, NO_GROUPING } from "./types";

export type { AttributeBadge } from "./data-renderer-badge-helpers";
export { getAttributeBadgeColorPalette } from "./data-renderer-badge-helpers";
export { enumOptionLabel, findEnumOption, getEnumOptions, toTitleCase } from "./data-renderer-enum-helpers";

/**
 * Read a typed attribute value out of a row. enum-multi normalizes to an array;
 * single-valued kinds normalize to undefined when missing.
 */
export const getAttributeValue = (row: DataRendererRow, descriptor: AttributeDescriptor) => {
  const raw = row.attributes[descriptor.id];
  if (descriptor.type.kind === "enum-multi") {
    if (Array.isArray(raw)) return raw.filter((entry): entry is string => typeof entry === "string");
    return [] as string[];
  }
  return raw;
};

export const getAttributeStringValues = (row: DataRendererRow, descriptor: AttributeDescriptor): string[] => {
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

interface WorkspaceBadgeItem {
  id: string;
  name: string;
  shorthand?: string;
  type: WorkspaceBadgeProps["workspaceType"];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const textValue = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : undefined);

const workspaceTypeFrom = (value: unknown): WorkspaceBadgeProps["workspaceType"] =>
  value === "current_branch" ? "current_branch" : "worktree";

const normalizeWorkspaceBadgeItems = (value: unknown): WorkspaceBadgeItem[] => {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const id = textValue(item.id);
    if (!id) return [];
    const shorthand = textValue(item.shorthand);
    const name = textValue(item.name) ?? shorthand ?? id;
    return [{ id, name, ...(shorthand ? { shorthand } : {}), type: workspaceTypeFrom(item.type) }];
  });
};

const renderWorkspaceBadgeDisplay = (
  descriptor: AttributeDescriptor,
  value: unknown,
  row: DataRendererRow,
): ReactNode => {
  if (descriptor.display?.kind !== "workspace-badge") return null;
  const items = normalizeWorkspaceBadgeItems(row.attributes[descriptor.display.itemsAttributeId]);
  if (items.length === 0) return null;

  const selectedId = typeof value === "string" ? value : undefined;
  const selectedItem = items.find((item) => item.id === selectedId) ?? items[0];
  if (!selectedItem) return null;

  return createElement(WorkspaceBadge, {
    workspaceType: selectedItem.type,
    shorthand: selectedItem.shorthand ?? selectedItem.name,
    hasMultipleWorkspaces: items.length > 1,
    showLeadingSessionIndicator: false,
  });
};

/**
 * Per-type default cell summary used by the card / list end-content. Returns
 * null when the attribute has no displayable value.
 */
export const renderAttributeBadge = (descriptor: AttributeDescriptor, row: DataRendererRow): AttributeBadge | null => {
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
  row: DataRendererRow,
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
  row: DataRendererRow,
  attributes: AttributeDescriptor[],
  displayProperties: string[],
): ReactNode[] => {
  const slots: ReactNode[] = [];
  for (const id of displayProperties) {
    const descriptor = findAttribute(attributes, id);
    if (!descriptor || descriptor.displayable === false) continue;

    const value = getAttributeValue(row, descriptor);
    const slot = descriptor.render
      ? descriptor.render(value, row)
      : renderWorkspaceBadgeDisplay(descriptor, value, row);
    if (isRenderableNode(slot)) slots.push(slot);
  }
  return slots;
};

const collectValuesFromRows = (rows: DataRendererRow[], descriptor: AttributeDescriptor) => {
  const values = new Set<string>();
  for (const row of rows) {
    for (const value of getAttributeStringValues(row, descriptor)) values.add(value);
  }
  return values;
};

export interface FilterCategoryView {
  id: string;
  label: string;
  selectionMode: "single" | "multiple";
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
  rows: DataRendererRow[],
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
        selectionMode: descriptor.type.kind === "enum" ? "single" : "multiple",
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
  filters?: DataRendererFilterState,
) => {
  if (columnGrouping === NO_GROUPING) return undefined;
  const descriptor = findAttribute(attributes, columnGrouping);
  const active = filters?.[columnGrouping];
  if (descriptor && active && active.length > 0) return normalizeFilterValues(descriptor, active);
  if (!descriptor) return undefined;
  if (descriptor.type.kind === "enum") return getEnumOptions(descriptor.type).map((option) => option.value);
  return undefined;
};

export const normalizeFilterValues = (descriptor: AttributeDescriptor, values: string[]) => {
  if (descriptor.type.kind === "enum") return values.slice(0, 1);
  return values;
};

export const omitFilterCategory = (filters: DataRendererFilterState, id: string): DataRendererFilterState => {
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
  settings: DataRendererSettings,
  attributes: AttributeDescriptor[],
): DataRendererSettings => {
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

export const sanitizeFilters = (filters: DataRendererFilterState, attributes: AttributeDescriptor[]) => {
  const attributesById = new Map(attributes.map((attribute) => [attribute.id, attribute]));
  const next: DataRendererFilterState = {};
  for (const [id, values] of Object.entries(filters)) {
    const descriptor = attributesById.get(id);
    if (!descriptor) continue;
    if (!values || values.length === 0) continue;
    next[id] = normalizeFilterValues(descriptor, values);
  }
  return next;
};
