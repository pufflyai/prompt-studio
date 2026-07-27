import {
  enumOptionLabel,
  getAttributeStringValues,
  getAttributeValue,
  getEnumOptions,
  normalizeFilterValues,
  toTitleCase,
} from "./kanban-renderer-helpers";
import {
  type AttributeDescriptor,
  type AttributeType,
  findAttribute,
  type KanbanRendererFilterState,
  type KanbanRendererOrdering,
  type KanbanRendererRow,
  MANUAL_ORDERING,
  NO_GROUPING,
} from "./types";

interface GroupingOptions {
  attributes: AttributeDescriptor[];
  columnGrouping: string;
  rowGrouping: string;
  knownColumnKeys?: string[];
}

interface KanbanRendererRowGroup {
  key: string;
  label: string;
  rows: KanbanRendererRow[];
}

interface KanbanRendererColumnGroup {
  key: string;
  label: string;
  rows: KanbanRendererRow[];
  subgroups: KanbanRendererRowGroup[];
}

const UNASSIGNED_LABEL = "Unassigned";

const fallbackLabel = (descriptor: AttributeDescriptor) => `No ${descriptor.label.toLowerCase()}`;

const labelForGroupKey = (key: string, descriptor: AttributeDescriptor | undefined) => {
  if (!descriptor) return key === NO_GROUPING ? "All" : key;
  if (descriptor.type.kind === "enum" || descriptor.type.kind === "enum-multi")
    return enumOptionLabel(descriptor.type, key);
  return key;
};

// Drops values that are no longer a declared enum option so rows pointing at a
// removed status collapse into the "No <attribute>" column instead of stranding
// an orphaned column keyed by the deleted value.
const resolveGroupingValue = (value: string | undefined, descriptor: AttributeDescriptor) => {
  if (value === undefined) return undefined;
  if (descriptor.type.kind !== "enum" && descriptor.type.kind !== "enum-multi") return value;
  return getEnumOptions(descriptor.type).some((option) => option.value === value) ? value : undefined;
};

const getGroupingKey = (row: KanbanRendererRow, descriptor: AttributeDescriptor | undefined, columnId: string) => {
  if (columnId === NO_GROUPING) return "all";
  if (!descriptor) return "all";
  // Grouping by an enum-multi is intentionally rejected at the renderer level
  // (the contribution lists it as non-groupable). Defensive fallback: treat
  // each row as a single bucket using its first value, else fallback.
  if (descriptor.type.kind === "enum-multi") {
    const [first] = getAttributeStringValues(row, descriptor);
    return resolveGroupingValue(first, descriptor) ?? fallbackLabel(descriptor);
  }
  const [value] = getAttributeStringValues(row, descriptor);
  return resolveGroupingValue(value, descriptor) ?? fallbackLabel(descriptor);
};

const compareGroupKey = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

const compareGroupKeyForDescriptor = (a: string, b: string, descriptor: AttributeDescriptor | undefined) => {
  if (descriptor && (descriptor.type.kind === "enum" || descriptor.type.kind === "enum-multi")) {
    const ordered = compareEnumValues(a, b, descriptor.type);
    if (ordered !== 0) return ordered;
  }
  return compareGroupKey(a, b);
};

const orderByDirection = (value: number, direction: KanbanRendererOrdering["direction"]) =>
  direction === "asc" ? value : value * -1;

const compareEnumValues = (left: string | undefined, right: string | undefined, type: AttributeType) => {
  if (type.kind !== "enum" && type.kind !== "enum-multi") return 0;
  const options = getEnumOptions(type);
  const toIndex = (value: string | undefined) => {
    if (value === undefined) return options.length;
    const index = options.findIndex((option) => option.value === value);
    return index === -1 ? options.length + 1 : index;
  };
  return toIndex(left) - toIndex(right);
};

const compareForDescriptor = (a: KanbanRendererRow, b: KanbanRendererRow, descriptor: AttributeDescriptor) => {
  if (descriptor.compare) return descriptor.compare(getAttributeValue(a, descriptor), getAttributeValue(b, descriptor));

  const left = getAttributeValue(a, descriptor);
  const right = getAttributeValue(b, descriptor);

  if (descriptor.type.kind === "date") {
    const leftTime = typeof left === "string" ? new Date(left).getTime() : 0;
    const rightTime = typeof right === "string" ? new Date(right).getTime() : 0;
    return leftTime - rightTime;
  }

  if (descriptor.type.kind === "number") {
    const leftNum = typeof left === "number" ? left : Number(left ?? 0);
    const rightNum = typeof right === "number" ? right : Number(right ?? 0);
    return leftNum - rightNum;
  }

  if (descriptor.type.kind === "enum" || descriptor.type.kind === "enum-multi") {
    const [leftValue] = getAttributeStringValues(a, descriptor);
    const [rightValue] = getAttributeStringValues(b, descriptor);
    return compareEnumValues(leftValue, rightValue, descriptor.type);
  }

  const leftString = typeof left === "string" ? left : String(left ?? "");
  const rightString = typeof right === "string" ? right : String(right ?? "");
  return leftString.localeCompare(rightString, undefined, { numeric: true });
};

export const orderRows = (
  rows: KanbanRendererRow[],
  ordering: KanbanRendererOrdering,
  attributes: AttributeDescriptor[],
) => {
  if (ordering.attributeId === MANUAL_ORDERING) return rows;

  if (ordering.attributeId === "title") {
    return [...rows].sort((a, b) => orderByDirection(a.title.localeCompare(b.title), ordering.direction));
  }

  const descriptor = findAttribute(attributes, ordering.attributeId);
  if (!descriptor) return rows;

  return [...rows].sort((a, b) => orderByDirection(compareForDescriptor(a, b, descriptor), ordering.direction));
};

export const groupRows = (rows: KanbanRendererRow[], options: GroupingOptions): KanbanRendererColumnGroup[] => {
  const { attributes, columnGrouping, rowGrouping, knownColumnKeys } = options;
  const columnDescriptor = findAttribute(attributes, columnGrouping);
  const rowDescriptor = findAttribute(attributes, rowGrouping);
  const groupedByColumn = new Map<string, KanbanRendererRow[]>();

  if (knownColumnKeys) {
    for (const key of knownColumnKeys) groupedByColumn.set(key, []);
  }

  for (const row of rows) {
    const key = getGroupingKey(row, columnDescriptor, columnGrouping);
    groupedByColumn.set(key, [...(groupedByColumn.get(key) ?? []), row]);
  }

  const columnEntries = [...groupedByColumn.entries()].sort(([left], [right]) =>
    compareGroupKeyForDescriptor(left, right, columnDescriptor),
  );

  return columnEntries.map(([columnKey, columnRows]) => {
    const label = labelForGroupKey(columnKey, columnDescriptor);

    if (rowGrouping === NO_GROUPING) {
      return { key: columnKey, label, rows: columnRows, subgroups: [] };
    }

    const groupedByRow = new Map<string, KanbanRendererRow[]>();
    for (const row of columnRows) {
      const rowKey = getGroupingKey(row, rowDescriptor, rowGrouping);
      groupedByRow.set(rowKey, [...(groupedByRow.get(rowKey) ?? []), row]);
    }

    const subgroups = [...groupedByRow.entries()]
      .sort(([left], [right]) => compareGroupKeyForDescriptor(left, right, rowDescriptor))
      .map(([rowKey, rowRows]) => ({
        key: rowKey,
        label: labelForGroupKey(rowKey, rowDescriptor) || toTitleCase(rowKey || UNASSIGNED_LABEL),
        rows: rowRows,
      }));

    return { key: columnKey, label, rows: columnRows, subgroups };
  });
};

const matchesFilter = (row: KanbanRendererRow, descriptor: AttributeDescriptor, values: string[]) => {
  const rowValues = getAttributeStringValues(row, descriptor);
  const normalizedValues = normalizeFilterValues(descriptor, values);
  return rowValues.some((value) => normalizedValues.includes(value));
};

export const filterRows = (
  rows: KanbanRendererRow[],
  filters: KanbanRendererFilterState,
  attributes: AttributeDescriptor[],
) => {
  const activeFilters = Object.entries(filters).filter(
    (entry): entry is [string, string[]] => Array.isArray(entry[1]) && entry[1].length > 0,
  );
  if (activeFilters.length === 0) return rows;

  return rows.filter((row) =>
    activeFilters.every(([id, values]) => {
      const descriptor = findAttribute(attributes, id);
      if (!descriptor) return true;
      return matchesFilter(row, descriptor, values);
    }),
  );
};

export const countFilterValues = (
  rows: KanbanRendererRow[],
  attributeId: string,
  attributes: AttributeDescriptor[],
) => {
  const counts: Record<string, number> = {};
  const descriptor = findAttribute(attributes, attributeId);
  if (!descriptor) return counts;
  for (const row of rows) {
    for (const value of getAttributeStringValues(row, descriptor)) {
      counts[value] = (counts[value] ?? 0) + 1;
    }
  }
  return counts;
};

export type { KanbanRendererColumnGroup, KanbanRendererRowGroup };
