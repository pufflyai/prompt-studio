import { createContext, type KeyboardEvent, type MouseEvent, type ReactNode, useRef } from "react";
import type { TreeListProps } from "./tree-list";
import { buildVirtualRows } from "./tree-list-model";
import { selectTreeListNodes, treeListSiblingMove } from "./tree-list-selection";

interface TreeListSelection {
  select(id: string, event: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>): void;
  keyDown(id: string, event: KeyboardEvent<HTMLElement>): void;
}
export const TreeListSelectionContext = createContext<TreeListSelection | undefined>(undefined);

export const TreeListSelectionProvider = (props: { tree: TreeListProps; children: ReactNode }) => {
  const { tree, children } = props;
  const anchor = useRef<string | undefined>(undefined);
  const selectedIds = [tree.activeNodeId ?? []].flat();
  const rows = buildVirtualRows(tree.sections, tree.expandedSectionIds ?? [], tree.expandedNodeIds ?? []);
  const ids = rows.flatMap((row) => (row.kind === "node" && !row.node.disabled ? [row.node.id] : []));
  const select: TreeListSelection["select"] = (id, event) => {
    event.preventDefault();
    tree.onSelectionChange?.(selectTreeListNodes(ids, selectedIds, id, anchor.current ?? selectedIds[0], event));
    if (!event.shiftKey) anchor.current = id;
  };
  const keyDown: TreeListSelection["keyDown"] = (id, event) => {
    if (event.target !== event.currentTarget) return;
    if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      event.preventDefault();
      event.stopPropagation();
      const move = treeListSiblingMove(tree.sections, id, event.key === "ArrowUp" ? -1 : 1, selectedIds);
      if (move) tree.onMoveNode?.(move.source, move.target, move.position);
      return;
    }
    if (event.key === " " || event.key === "Enter") select(id, event);
  };
  return (
    <TreeListSelectionContext value={tree.onSelectionChange ? { select, keyDown } : undefined}>
      {children}
    </TreeListSelectionContext>
  );
};
