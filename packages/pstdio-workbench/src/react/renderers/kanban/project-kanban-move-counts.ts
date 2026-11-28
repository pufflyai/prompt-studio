import type { CollectionPage, CollectionPageGroup, KanbanRendererMove } from "@pstdio/sdk/extensions";
import { applyKanbanMove } from "@pstdio/ui/kanban-renderer";
import type { KanbanRendererRow, KanbanRendererSettings } from "../../../core";

type Grouping = Pick<KanbanRendererSettings, "columnGrouping" | "rowGrouping">;
type Snapshot = { page?: CollectionPage; rows: KanbanRendererRow[] };

const groupValue = (row: KanbanRendererRow, field: string) => {
  const value = row.attributes[field];
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? value : null;
};

const rowGroups = (row: KanbanRendererRow, { columnGrouping, rowGrouping }: Grouping) => {
  if (columnGrouping === "none") return [];
  const column = { field: columnGrouping, value: groupValue(row, columnGrouping) };
  return rowGrouping === "none" || rowGrouping === columnGrouping
    ? [column]
    : [column, { field: rowGrouping, value: groupValue(row, rowGrouping), parent: column }];
};

const groupKey = ({ field, value, parent }: Omit<CollectionPageGroup, "count">) =>
  JSON.stringify([field, value, parent?.field, parent?.value]);

export const projectKanbanMoveCounts = <T extends Snapshot>(
  snapshot: T | undefined,
  rows: KanbanRendererRow[],
  grouping: Grouping,
): T | undefined => {
  if (!snapshot || rows === snapshot.rows) return snapshot;
  const { page } = snapshot;
  if (!page || !rows.length) return { ...snapshot, rows };

  const original = new Map(snapshot.rows.map((row) => [row.id, row]));
  const groups = new Map(page.groups.map((group) => [groupKey(group), group]));
  let changed = false;
  const adjust = (group: Omit<CollectionPageGroup, "count">, amount: number) => {
    const key = groupKey(group);
    const current = groups.get(key);
    groups.set(key, { ...group, count: Math.max(0, (current?.count ?? 0) + amount) });
    changed = true;
  };
  for (const row of rows) {
    const previous = original.get(row.id);
    if (!previous || previous === row) continue;
    const nextGroups = rowGroups(row, grouping);
    for (const [index, previousGroup] of rowGroups(previous, grouping).entries()) {
      const nextGroup = nextGroups[index];
      if (groupKey(previousGroup) === groupKey(nextGroup)) continue;
      adjust(previousGroup, -1);
      adjust(nextGroup, 1);
    }
  }
  return { ...snapshot, rows, page: changed ? { ...page, groups: [...groups.values()] } : page };
};

export const projectAcknowledgedMove = <T extends Snapshot>(
  snapshot: T,
  move: KanbanRendererMove,
  settings: Grouping,
) => projectKanbanMoveCounts(snapshot, applyKanbanMove(snapshot.rows, move), settings) ?? snapshot;
