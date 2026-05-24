import type { ReactNode } from "react";
import type {
  AttributeDescriptor,
  AttributeType,
  DataRendererFilterState,
  DataRendererRow,
  DataRendererSettings,
  EnumOption,
} from "./types";
import { findAttribute, isEnumOptionsSource, MANUAL_ORDERING, NO_GROUPING } from "./types";

/**
 * Normalize an enum / enum-multi attribute's `options` to a plain `EnumOption[]`.
 * Sources resolve via `getSnapshot()` on every call, so callers naturally see
 * the latest values — pair with `useResolvedAttributes` to also rerender on
 * source change.
 */
export const getEnumOptions = (type: AttributeType): EnumOption[] => {
  if (type.kind !== "enum" && type.kind !== "enum-multi") return [];
  return isEnumOptionsSource(type.options) ? type.options.getSnapshot() : type.options;
};

export const toTitleCase = (value: string) =>
  value
    .replaceAll("_", " ")
    .split(" ")
    .filter((chunk) => chunk.length > 0)
    .map((chunk) => chunk[0]!.toUpperCase() + chunk.slice(1))
    .join(" ");

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

export const findEnumOption = (type: AttributeType, value: string): EnumOption | undefined => {
  if (type.kind !== "enum" && type.kind !== "enum-multi") return undefined;
  return getEnumOptions(type).find((option) => option.value === value);
};

export const enumOptionLabel = (type: AttributeType, value: string) => {
  const option = findEnumOption(type, value);
  return option?.label ?? toTitleCase(value);
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

const summarizeMultiEnum = (values: string[], type: AttributeType) => {
  if (values.length === 0) return null;
  if (values.length <= 2) return values.map((value) => enumOptionLabel(type, value)).join(", ");
  return `${enumOptionLabel(type, values[0]!)}, ${enumOptionLabel(type, values[1]!)} +${values.length - 2}`;
};

export interface AttributeBadge {
  attributeId: string;
  label: string;
  color?: string;
}

const renderEnumBadge = (descriptor: AttributeDescriptor, type: AttributeType, value: unknown) => {
  if (type.kind !== "enum") return null;
  const stringValue = typeof value === "string" ? value : null;
  if (!stringValue) return null;
  const option = findEnumOption(type, stringValue);
  return { attributeId: descriptor.id, label: option?.label ?? toTitleCase(stringValue), color: option?.color };
};

const renderMultiEnumBadge = (descriptor: AttributeDescriptor, type: AttributeType, value: unknown) => {
  if (type.kind !== "enum-multi") return null;
  const values = value as string[];
  const summary = summarizeMultiEnum(values, type);
  if (!summary) return null;
  const firstColor = values[0] ? findEnumOption(type, values[0])?.color : undefined;
  return { attributeId: descriptor.id, label: summary, color: firstColor };
};

const isRenderableNode = (value: unknown) => value !== null && value !== undefined && value !== false;

/**
 * Per-type default cell summary used by the card / list end-content. Returns
 * null when the attribute has no displayable value.
 */
export const renderAttributeBadge = (descriptor: AttributeDescriptor, row: DataRendererRow): AttributeBadge | null => {
  const type = descriptor.type;
  const value = getAttributeValue(row, descriptor);

  if (descriptor.render) return null;

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
    if (!descriptor?.render || descriptor.displayable === false) continue;

    const slot = descriptor.render(getAttributeValue(row, descriptor), row);
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
    categories.push({ id: descriptor.id, label: descriptor.label, options: auto });
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
  const active = filters?.[columnGrouping];
  if (active && active.length > 0) return active;
  const descriptor = findAttribute(attributes, columnGrouping);
  if (!descriptor) return undefined;
  if (descriptor.type.kind === "enum") return getEnumOptions(descriptor.type).map((option) => option.value);
  return undefined;
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
  const knownIds = new Set(attributes.map((attribute) => attribute.id));
  const next: DataRendererFilterState = {};
  for (const [id, values] of Object.entries(filters)) {
    if (!knownIds.has(id)) continue;
    if (!values || values.length === 0) continue;
    next[id] = values;
  }
  return next;
};
