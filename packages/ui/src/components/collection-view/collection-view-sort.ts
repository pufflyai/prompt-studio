import type { ViewSort } from "@pstdio/sdk/extensions";
import { getEnumOptions } from "../kanban-renderer/kanban-renderer-enum-helpers";
import type { AttributeDescriptor, AttributeType, KanbanRendererRow } from "../kanban-renderer/types";
import {
  canSortField,
  findField,
  getAttributeStringValues,
  getAttributeValue,
  parseViewDate,
} from "./collection-view-fields";

/** Option order: declared options first, unknown values after them, missing values last. */
export const compareEnumValues = (left: string | undefined, right: string | undefined, type: AttributeType) => {
  if (type.kind !== "enum" && type.kind !== "enum-multi") return 0;
  const options = getEnumOptions(type);
  const toIndex = (value: string | undefined) => {
    if (value === undefined) return options.length;
    const index = options.findIndex((option) => option.value === value);
    return index === -1 ? options.length + 1 : index;
  };
  return toIndex(left) - toIndex(right);
};

const toTime = (value: unknown) => parseViewDate(value)?.getTime() ?? Number.NaN;

const compareFieldValues = (a: KanbanRendererRow, b: KanbanRendererRow, field: AttributeDescriptor) => {
  const left = getAttributeValue(a, field);
  const right = getAttributeValue(b, field);
  if (field.compare) return field.compare(left, right);
  if (field.type.kind === "date") return toTime(left) - toTime(right);
  if (field.type.kind === "number") return Number(left) - Number(right);
  if (field.type.kind === "enum") {
    const [leftValue] = getAttributeStringValues(a, field);
    const [rightValue] = getAttributeStringValues(b, field);
    return compareEnumValues(leftValue, rightValue, field.type);
  }
  return String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: "base" });
};

const isEmpty = (row: KanbanRendererRow, field: AttributeDescriptor) => {
  if (field.type.kind === "date") return parseViewDate(getAttributeValue(row, field)) === undefined;
  const [value] = getAttributeStringValues(row, field);
  if (value === undefined) return true;
  if (field.type.kind === "number") return !Number.isFinite(Number(value));
  return false;
};

const compileSort = (sort: ViewSort, fields: AttributeDescriptor[]) => {
  const field = findField(fields, sort.attributeId);
  if (!field || !canSortField(field)) return undefined;
  const direction = sort.direction === "asc" ? 1 : -1;
  // Rows without a value stay last in both directions.
  return (a: KanbanRendererRow, b: KanbanRendererRow) => {
    const leftEmpty = isEmpty(a, field);
    const rightEmpty = isEmpty(b, field);
    if (leftEmpty || rightEmpty) return Number(leftEmpty) - Number(rightEmpty);
    return direction * compareFieldValues(a, b, field);
  };
};

/** One field decides the order; ties keep their incoming order. */
export const sortRowsByView = <TRow extends KanbanRendererRow>(
  rows: TRow[],
  sorts: ViewSort[],
  fields: AttributeDescriptor[],
) => {
  const sort = sorts[0];
  const compare = sort ? compileSort(sort, fields) : undefined;
  return compare ? [...rows].sort(compare) : rows;
};
