import type { TreeListNode, TreeListSection } from "./tree-list.types";

export const isInList = (id: string, values: string[]) => values.includes(id);

export const isActiveNode = (id: string, activeNodeId?: string | string[] | null) =>
  Array.isArray(activeNodeId) ? activeNodeId.includes(id) : activeNodeId === id;

export const isNavigableNode = (node: TreeListNode) => node.isNavigable || node.navigationIntent !== undefined;

export const getNodeChildren = (node: TreeListNode) => (node.children as TreeListNode[] | undefined) ?? [];

export const hasExpandableChildren = (node: TreeListNode) =>
  getNodeChildren(node).length > 0 || node.isContainer === true;

export type VirtualRow =
  | {
      kind: "section-header";
      key: string;
      sectionId: string;
      section: TreeListSection;
      collapsible: boolean;
      expanded: boolean;
    }
  | { kind: "node"; key: string; sectionId: string; node: TreeListNode; level: number; parentNodeId?: string }
  | { kind: "section-empty"; key: string; sectionId: string; emptyState: TreeListSection["emptyState"] };

export type VirtualNodeRow = Extract<VirtualRow, { kind: "node" }>;
export type VirtualSectionHeaderRow = Extract<VirtualRow, { kind: "section-header" }>;

/** Rows the keyboard can land on: enabled nodes and collapsible section headers. */
export type FocusableRow = VirtualNodeRow | VirtualSectionHeaderRow;

const appendVisibleNodeRows = (input: {
  rows: VirtualRow[];
  sectionId: string;
  nodes: TreeListNode[];
  expandedNodeIds: string[];
  level: number;
  parentNodeId?: string;
}) => {
  const { rows, sectionId, nodes, expandedNodeIds, level, parentNodeId } = input;

  for (const node of nodes) {
    rows.push({ kind: "node", key: `${sectionId}:${node.id}`, sectionId, node, level, parentNodeId });

    const children = getNodeChildren(node);
    if (children.length === 0 || !isInList(node.id, expandedNodeIds)) continue;

    appendVisibleNodeRows({
      rows,
      sectionId,
      nodes: children,
      expandedNodeIds,
      level: level + 1,
      parentNodeId: node.id,
    });
  }
};

export const buildVirtualRows = (
  sections: TreeListSection[],
  expandedSectionIds: string[],
  expandedNodeIds: string[],
) => {
  const rows: VirtualRow[] = [];
  for (const section of sections) {
    const collapsible = section.collapsible !== false && section.label !== undefined;
    const expanded = collapsible ? isInList(section.id, expandedSectionIds) : true;
    if (section.label) {
      rows.push({
        kind: "section-header",
        key: `header:${section.id}`,
        sectionId: section.id,
        section,
        collapsible,
        expanded,
      });
    }
    if (!expanded) continue;
    if (section.nodes.length === 0) {
      if (section.emptyState) {
        rows.push({
          kind: "section-empty",
          key: `empty:${section.id}`,
          sectionId: section.id,
          emptyState: section.emptyState,
        });
      }
      continue;
    }
    appendVisibleNodeRows({ rows, sectionId: section.id, nodes: section.nodes, expandedNodeIds, level: 0 });
  }
  return rows;
};

/** Stable id used to track keyboard focus across renders. */
export const getRowFocusId = (row: FocusableRow) => (row.kind === "node" ? row.node.id : row.key);

export const isFocusableRow = (row: VirtualRow): row is FocusableRow => {
  if (row.kind === "node") return row.node.disabled !== true;
  return row.kind === "section-header" && row.collapsible;
};

export const getFocusableRows = (rows: VirtualRow[]) => rows.filter(isFocusableRow);

export const resolveTreeListFocusRowId = (
  focusedRowId: string | undefined,
  activeNodeId: string | string[] | null | undefined,
  rows: VirtualRow[],
) => {
  const focusableRows = getFocusableRows(rows);
  const focusableIds = new Set(focusableRows.map(getRowFocusId));
  if (focusedRowId && focusableIds.has(focusedRowId)) return focusedRowId;

  const activeIds = Array.isArray(activeNodeId) ? activeNodeId : activeNodeId ? [activeNodeId] : [];
  const activeId = activeIds.find((id) => focusableIds.has(id));
  if (activeId) return activeId;

  const firstRow = focusableRows[0];
  return firstRow ? getRowFocusId(firstRow) : undefined;
};

const resolveSectionHeaderNavigation = (input: {
  row: VirtualSectionHeaderRow;
  focusableRows: FocusableRow[];
  currentIndex: number;
  key: string;
}) => {
  const { row, focusableRows, currentIndex, key } = input;

  if (key === "Enter" || key === " ") return { type: "toggle-section" as const, sectionId: row.sectionId };

  if (key === "ArrowRight") {
    if (!row.expanded) return { type: "toggle-section" as const, sectionId: row.sectionId };

    const nextRow = focusableRows[currentIndex + 1];
    if (nextRow?.kind === "node" && nextRow.sectionId === row.sectionId) {
      return { type: "focus" as const, rowId: nextRow.node.id };
    }
    return null;
  }

  if (key === "ArrowLeft" && row.expanded) return { type: "toggle-section" as const, sectionId: row.sectionId };

  return null;
};

const resolveNodeNavigation = (input: {
  row: VirtualNodeRow;
  focusableRows: FocusableRow[];
  currentIndex: number;
  expandedNodeIds: string[];
  key: string;
}) => {
  const { row, focusableRows, currentIndex, expandedNodeIds, key } = input;
  const expanded = isInList(row.node.id, expandedNodeIds);
  const expandable = hasExpandableChildren(row.node);

  if (key === "ArrowRight") {
    if (!expandable) return null;
    if (!expanded) return { type: "toggle-node" as const, nodeId: row.node.id };

    const nextRow = focusableRows[currentIndex + 1];
    if (nextRow?.kind === "node" && nextRow.parentNodeId === row.node.id) {
      return { type: "focus" as const, rowId: nextRow.node.id };
    }
    return null;
  }

  if (key === "ArrowLeft") {
    if (expandable && expanded) return { type: "toggle-node" as const, nodeId: row.node.id };
    if (row.parentNodeId) return { type: "focus" as const, rowId: row.parentNodeId };
  }

  return null;
};

export const resolveTreeListKeyboardNavigation = (input: {
  rows: VirtualRow[];
  focusedRowId: string | undefined;
  activeNodeId?: string | string[] | null;
  expandedNodeIds: string[];
  key: string;
}) => {
  const { rows, focusedRowId, activeNodeId, expandedNodeIds, key } = input;
  const focusableRows = getFocusableRows(rows);
  if (focusableRows.length === 0) return null;

  const resolvedFocusRowId = resolveTreeListFocusRowId(focusedRowId, activeNodeId, rows);
  const currentIndex = Math.max(
    0,
    focusableRows.findIndex((row) => getRowFocusId(row) === resolvedFocusRowId),
  );
  const currentRow = focusableRows[currentIndex];
  if (!currentRow) return null;

  const focusByIndex = (index: number) => {
    const clamped = Math.min(Math.max(index, 0), focusableRows.length - 1);
    return { type: "focus" as const, rowId: getRowFocusId(focusableRows[clamped]!) };
  };

  if (key === "ArrowDown") return focusByIndex(currentIndex + 1);
  if (key === "ArrowUp") return focusByIndex(currentIndex - 1);
  if (key === "Home") return focusByIndex(0);
  if (key === "End") return focusByIndex(focusableRows.length - 1);

  if (currentRow.kind === "section-header") {
    return resolveSectionHeaderNavigation({ row: currentRow, focusableRows, currentIndex, key });
  }

  return resolveNodeNavigation({ row: currentRow, focusableRows, currentIndex, expandedNodeIds, key });
};
