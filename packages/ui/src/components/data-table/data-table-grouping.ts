import type { CollectionRowGroup } from "../collection-view/collection-view-grouping";
import type { KanbanRendererRow } from "../kanban-renderer/types";

export type DataTablePageEntry<TRow extends KanbanRendererRow> =
  | { kind: "group"; group: CollectionRowGroup<TRow> }
  | { kind: "row"; row: TRow };

/**
 * Pages count rows. A group that continues on the next page repeats its group row there, and a
 * collapsed group sits where its rows would start.
 */
export const pageGroupedRows = <TRow extends KanbanRendererRow>(
  groups: CollectionRowGroup<TRow>[],
  collapsed: Set<string>,
  pageIndex: number,
  pageSize: number,
) => {
  const shown = (group: CollectionRowGroup<TRow>) => (collapsed.has(group.key) ? [] : group.rows);
  const shownCount = groups.reduce((count, group) => count + shown(group).length, 0);
  const pageCount = Math.max(1, Math.ceil(shownCount / pageSize));
  const page = Math.min(pageIndex, pageCount - 1);
  const start = page * pageSize;
  const end = start + pageSize;
  const entries: DataTablePageEntry<TRow>[] = [];
  let position = 0;
  for (const group of groups) {
    const rows = shown(group);
    const groupStart = position;
    position += rows.length;
    const onPage =
      rows.length === 0
        ? (groupStart >= start && groupStart < end) || (groupStart === shownCount && page === pageCount - 1)
        : position > start && groupStart < end;
    if (!onPage) continue;
    entries.push({ kind: "group", group });
    for (let index = Math.max(groupStart, start); index < Math.min(position, end); index += 1)
      entries.push({ kind: "row", row: rows[index - groupStart]! });
  }
  return { entries, pageCount, page, shownCount };
};

export const pageRows = <TRow extends KanbanRendererRow>(rows: TRow[], pageIndex: number, pageSize: number) => {
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Math.min(pageIndex, pageCount - 1);
  const entries: DataTablePageEntry<TRow>[] = rows
    .slice(page * pageSize, (page + 1) * pageSize)
    .map((row) => ({ kind: "row", row }));
  return { entries, pageCount, page, shownCount: rows.length };
};
