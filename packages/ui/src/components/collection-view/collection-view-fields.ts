import { VIEW_FILTER_CONDITIONS, type ViewFilterCondition } from "@pstdio/sdk/extensions";
import { enumOptionLabel } from "../kanban-renderer/kanban-renderer-enum-helpers";
import type { AttributeDescriptor, KanbanRendererRow } from "../kanban-renderer/types";

/** Every kanban row has a title. Views filter, sort, and search it as a text field. */
export const TITLE_FIELD: AttributeDescriptor = {
  id: "title",
  label: "Title",
  type: { kind: "string" },
  filterable: true,
  sortable: true,
};

export const withTitleField = (attributes: AttributeDescriptor[]) =>
  attributes.some((attribute) => attribute.id === TITLE_FIELD.id) ? attributes : [TITLE_FIELD, ...attributes];

export const findField = (fields: AttributeDescriptor[], id: string) => fields.find((field) => field.id === id);

export const isOptionField = (field: AttributeDescriptor) =>
  field.type.kind === "enum" || field.type.kind === "enum-multi" || field.type.kind === "user";

/** enum-multi fields hold several values, so one order does not exist. */
export const canSortField = (field: AttributeDescriptor) => field.sortable === true && field.type.kind !== "enum-multi";

export const fieldConditions = (field: AttributeDescriptor) => VIEW_FILTER_CONDITIONS[field.type.kind];

/**
 * Rules written for single-value options also fit multi-value options and the reverse,
 * so a field that changes kind keeps its meaning.
 */
const EQUIVALENT_CONDITIONS: Partial<Record<ViewFilterCondition, ViewFilterCondition>> = {
  "is-any-of": "has-any-of",
  "has-any-of": "is-any-of",
  "is-none-of": "has-none-of",
  "has-none-of": "is-none-of",
};

export const acceptedCondition = (field: AttributeDescriptor, condition: ViewFilterCondition) => {
  const conditions = fieldConditions(field);
  if (conditions.includes(condition)) return condition;
  const equivalent = EQUIVALENT_CONDITIONS[condition];
  return equivalent && conditions.includes(equivalent) ? equivalent : undefined;
};

/**
 * Read a typed attribute value out of a row. enum-multi normalizes to an array;
 * single-valued kinds normalize to undefined when missing.
 */
export const getAttributeValue = (row: KanbanRendererRow, descriptor: AttributeDescriptor) => {
  const raw = descriptor === TITLE_FIELD ? row.title : row.attributes[descriptor.id];
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

const formatDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
};

/** The text a view shows for a field: option labels, dates as dates, everything else as written. */
export const formatFieldText = (row: KanbanRendererRow, field: AttributeDescriptor) => {
  const values = getAttributeStringValues(row, field);
  if (field.type.kind === "enum" || field.type.kind === "enum-multi")
    return values.map((value) => enumOptionLabel(field.type, value));
  if (field.type.kind === "date") return values.map(formatDate);
  return values;
};
