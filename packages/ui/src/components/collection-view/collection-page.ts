import type { CollectionPage, CollectionPageGroup, CollectionPageRequest } from "@pstdio/sdk/extensions";
import type { AttributeDescriptor, KanbanRendererRow } from "../kanban-renderer/types";
import { type CollectionRowGroup, groupKey, groupRowsByField } from "./collection-view-grouping";

export interface CollectionPageControl {
  request: CollectionPageRequest;
  /** Position belonging to the rows currently on screen. */
  displayed?: CollectionPageRequest;
  result?: CollectionPage;
  loading: boolean;
  onSearchChange: (search: string) => void;
  onPageChange: (index: number) => void;
  onPageSizeChange: (size: number) => void;
  onCollapsedGroupsChange: (keys: string[]) => void;
  onLoadMore?: () => void;
}

export const applyPageGroupCounts = <TRow extends KanbanRendererRow>(
  groups: CollectionRowGroup<TRow>[],
  counts: CollectionPageGroup[],
  field: AttributeDescriptor,
  parent?: { field: AttributeDescriptor; key: string },
) => {
  const keyFor = (value: unknown, descriptor: AttributeDescriptor) =>
    groupKey({ id: "", title: "", attributes: { [descriptor.id]: value } }, descriptor);
  const byKey = new Map<string, number>();
  for (const count of counts) {
    if (count.field !== field.id) continue;
    if (parent) {
      if (count.parent?.field !== parent.field.id || keyFor(count.parent.value, parent.field) !== parent.key) continue;
    } else if (count.parent) continue;
    const key = keyFor(count.value, field);
    byKey.set(key, (byKey.get(key) ?? 0) + count.count);
  }
  const rows = new Map(groups.map((group) => [group.key, group.rows]));
  return groupRowsByField<TRow>([], field, [...new Set([...byKey.keys(), ...rows.keys()])]).map((group) => ({
    ...group,
    rows: rows.get(group.key) ?? [],
    count: byKey.get(group.key) ?? 0,
  }));
};
