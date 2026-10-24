import type { CollectionPageGroup } from "@pstdio/sdk/extensions";
import { applyPageGroupCounts } from "../collection-view/collection-page";
import type { KanbanRendererColumnGroup } from "./kanban-renderer-grouping";
import { type AttributeDescriptor, findAttribute, type KanbanRendererSettings } from "./types";

export const applyKanbanPageCounts = (
  groups: KanbanRendererColumnGroup[],
  counts: CollectionPageGroup[] | undefined,
  attributes: AttributeDescriptor[],
  settings: KanbanRendererSettings,
  total?: number,
) => {
  const columnField = findAttribute(attributes, settings.columnGrouping);
  const rowField = findAttribute(attributes, settings.rowGrouping);
  if (!counts) return groups;
  if (!columnField)
    return groups.map((column) => ({
      ...column,
      count: total,
      subgroups: rowField ? applyPageGroupCounts(column.subgroups, counts, rowField) : [],
    }));
  return applyPageGroupCounts(groups, counts, columnField).map((column) => ({
    ...column,
    subgroups: rowField
      ? applyPageGroupCounts(groups.find((group) => group.key === column.key)?.subgroups ?? [], counts, rowField, {
          field: columnField,
          key: column.key,
        })
      : [],
  }));
};

export const pageTotal = (total: number | undefined, rows: unknown[]) => total ?? rows.length;
