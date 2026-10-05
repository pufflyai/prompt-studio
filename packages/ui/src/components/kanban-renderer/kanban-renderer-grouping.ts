import { getAttributeStringValues } from "../collection-view/collection-view-fields";
import { type CollectionRowGroup, groupRowsByField } from "../collection-view/collection-view-grouping";
import { type AttributeDescriptor, findAttribute, type KanbanRendererRow } from "./types";

interface GroupingOptions {
  attributes: AttributeDescriptor[];
  columnGrouping: string;
  rowGrouping: string;
  knownColumnKeys?: string[];
  /** Source rows define the group structure; filtered rows supply its contents. */
  structureRows?: KanbanRendererRow[];
}

type KanbanRendererRowGroup = CollectionRowGroup;

interface KanbanRendererColumnGroup extends CollectionRowGroup {
  subgroups: KanbanRendererRowGroup[];
}

/** Columns follow the grouping field's group order; sub-groups split each column the same way. */
export const groupRows = (rows: KanbanRendererRow[], options: GroupingOptions): KanbanRendererColumnGroup[] => {
  const { attributes, columnGrouping, rowGrouping, knownColumnKeys, structureRows = rows } = options;
  const columnField = findAttribute(attributes, columnGrouping);
  const rowField = findAttribute(attributes, rowGrouping);
  const structure = columnField ? groupRowsByField(structureRows, columnField) : [];
  const columns = columnField
    ? groupRowsByField(rows, columnField, knownColumnKeys ?? structure.map((group) => group.key))
    : [{ key: "all", label: "All", rows }];
  return columns.map((column) => {
    const source = columnField ? (structure.find((group) => group.key === column.key)?.rows ?? []) : structureRows;
    const keys = rowField ? groupRowsByField(source, rowField).map((group) => group.key) : [];
    return { ...column, subgroups: rowField ? groupRowsByField(column.rows, rowField, keys) : [] };
  });
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
