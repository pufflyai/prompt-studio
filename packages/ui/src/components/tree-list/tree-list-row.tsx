import type { StackProps } from "@chakra-ui/react";
import type { MouseEvent as ReactMouseEvent } from "react";
import type { TreeListLinkComponent, TreeListNavigateEvent } from "./tree-list.types";
import type { VirtualRow } from "./tree-list-model";
import { TreeListNodeRow } from "./tree-list-node-row";
import { TreeListSectionHeader } from "./tree-list-section-header";

type TreeListRowVariant = "compact" | "tree";

interface TreeListRowProps {
  row: VirtualRow;
  expandedNodeIds: string[];
  activeNodeId?: string | string[] | null;
  focusRowId?: string;
  rowVariant: TreeListRowVariant;
  nodeGap: StackProps["gap"];
  linkComponent?: TreeListLinkComponent;
  onRowFocus: (rowId: string) => void;
  onNavigate?: (event: TreeListNavigateEvent) => void;
  onToggleSection?: (sectionId: string) => void;
  onToggleNode?: (nodeId: string) => void;
  onSectionContextMenu?: (event: ReactMouseEvent<HTMLElement>, sectionId: string) => void;
  onMoveNode?: (sourceNodeId: string, targetNodeId?: string, position?: "before" | "after" | "inside") => void;
}

export const TreeListRow = (props: TreeListRowProps) => {
  const {
    row,
    expandedNodeIds,
    activeNodeId,
    focusRowId,
    rowVariant,
    nodeGap,
    linkComponent,
    onRowFocus,
    onNavigate,
    onToggleSection,
    onToggleNode,
    onSectionContextMenu,
    onMoveNode,
  } = props;

  if (row.kind === "section-header") {
    return (
      <TreeListSectionHeader
        section={row.section}
        collapsible={row.collapsible}
        expanded={row.expanded}
        focusId={row.key}
        tabIndex={row.key === focusRowId ? 0 : -1}
        onFocus={() => onRowFocus(row.key)}
        onToggle={() => onToggleSection?.(row.sectionId)}
        onContextMenu={onSectionContextMenu}
      />
    );
  }

  if (row.kind === "section-empty") return row.emptyState ?? null;

  return (
    <TreeListNodeRow
      sectionId={row.sectionId}
      node={row.node}
      level={row.level}
      expandedNodeIds={expandedNodeIds}
      activeNodeId={activeNodeId}
      rowVariant={rowVariant}
      nodeGap={nodeGap}
      linkComponent={linkComponent}
      tabIndex={row.node.id === focusRowId ? 0 : -1}
      onFocus={() => onRowFocus(row.node.id)}
      onNavigate={onNavigate}
      onToggleNode={onToggleNode}
      onMoveNode={onMoveNode}
    />
  );
};
