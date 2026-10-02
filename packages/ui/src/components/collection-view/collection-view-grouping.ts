import { enumOptionLabel, getEnumOptions } from "../kanban-renderer/kanban-renderer-enum-helpers";
import type { AttributeDescriptor, KanbanRendererRow } from "../kanban-renderer/types";
import { getAttributeStringValues } from "./collection-view-fields";
import { compareEnumValues } from "./collection-view-sort";

export interface CollectionRowGroup<TRow extends KanbanRendererRow = KanbanRendererRow> {
  key: string;
  label: string;
  rows: TRow[];
}

export const emptyGroupKey = (field: AttributeDescriptor) => `No ${field.label.toLowerCase()}`;

export const groupLabel = (key: string, field: AttributeDescriptor) => {
  if (key === emptyGroupKey(field)) return key;
  if (field.type.kind === "enum" || field.type.kind === "enum-multi") return enumOptionLabel(field.type, key);
  return key;
};

// Drops values that are no longer a declared option, so rows pointing at a removed
// status join the "No <field>" group instead of an orphaned group for the deleted value.
const resolveGroupValue = (value: string | undefined, field: AttributeDescriptor) => {
  if (value === undefined) return undefined;
  if (field.type.kind !== "enum" && field.type.kind !== "enum-multi") return value;
  return getEnumOptions(field.type).some((option) => option.value === value) ? value : undefined;
};

/** One group per row. A multi-value field is not offered for grouping, so its first value decides. */
export const groupKey = (row: KanbanRendererRow, field: AttributeDescriptor) => {
  const [value] = getAttributeStringValues(row, field);
  return resolveGroupValue(value, field) ?? emptyGroupKey(field);
};

/** Option fields follow option order, other fields go A to Z, and the "No <field>" group comes last. */
export const compareGroupKeys = (left: string, right: string, field: AttributeDescriptor) => {
  const empty = emptyGroupKey(field);
  if (left === empty || right === empty) return Number(left === empty) - Number(right === empty);
  const ordered = compareEnumValues(left, right, field.type);
  if (ordered !== 0) return ordered;
  return left.localeCompare(right, undefined, { numeric: true });
};

export const groupRowsByField = <TRow extends KanbanRendererRow>(
  rows: TRow[],
  field: AttributeDescriptor,
  knownKeys: string[] = [],
): CollectionRowGroup<TRow>[] => {
  const groups = new Map<string, TRow[]>(knownKeys.map((key) => [key, []]));
  for (const row of rows) {
    const key = groupKey(row, field);
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => compareGroupKeys(left, right, field))
    .map(([key, groupRows]) => ({ key, label: groupLabel(key, field), rows: groupRows }));
};
