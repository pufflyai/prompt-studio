import { getAttributeStringValues } from "../collection-view/collection-view-fields";
import { type CollectionRowGroup, groupRowsByField } from "../collection-view/collection-view-grouping";
import { type AttributeDescriptor, findAttribute, type KanbanRendererRow } from "./types";

interface GroupingOptions {
  attributes: AttributeDescriptor[];
  columnGrouping: string;
  rowGrouping: string;
  knownColumnKeys?: string[];
}

type KanbanRendererRowGroup = CollectionRowGroup;

interface KanbanRendererColumnGroup extends CollectionRowGroup {
  subgroups: KanbanRendererRowGroup[];
}

/** Columns follow the grouping field's group order; sub-groups split each column the same way. */
export const groupRows = (rows: KanbanRendererRow[], options: GroupingOptions): KanbanRendererColumnGroup[] => {
  const { attributes, columnGrouping, rowGrouping, knownColumnKeys } = options;
  const columnField = findAttribute(attributes, columnGrouping);
  const rowField = findAttribute(attributes, rowGrouping);
  const columns = columnField
    ? groupRowsByField(rows, columnField, knownColumnKeys)
    : [{ key: "all", label: "All", rows }];
  return columns.map((column) => ({
    ...column,
    subgroups: rowField ? groupRowsByField(column.rows, rowField) : [],
  }));
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
