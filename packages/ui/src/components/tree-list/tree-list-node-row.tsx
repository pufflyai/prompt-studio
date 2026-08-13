import type { StackProps } from "@chakra-ui/react";
import { Stack } from "@chakra-ui/react";
import type { FocusEventHandler, DragEvent as ReactDragEvent } from "react";
import { ListRow } from "../list-row/list-row";
import type { TreeListLinkComponent, TreeListNavigateEvent, TreeListNode } from "./tree-list.types";
import { readDraggedTreeNodeId, writeDraggedTreeNodeId } from "./tree-list-drag";
import { TreeListInlineInputRow } from "./tree-list-inline-input";
import { hasExpandableChildren, isActiveNode, isInList, isNavigableNode } from "./tree-list-model";

type TreeListRowVariant = "compact" | "tree";

interface TreeListNodeRowProps {
  sectionId: string;
  node: TreeListNode;
  level: number;
  expandedNodeIds: string[];
  activeNodeId?: string | string[] | null;
  rowVariant: TreeListRowVariant;
  nodeGap: StackProps["gap"];
  linkComponent?: TreeListLinkComponent;
  tabIndex?: number;
  onFocus?: FocusEventHandler<HTMLElement>;
  onNavigate?: (event: TreeListNavigateEvent) => void;
  onToggleNode?: (nodeId: string) => void;
  onMoveNode?: (sourceNodeId: string, targetNodeId?: string) => void;
}

export const TreeListNodeRow = (props: TreeListNodeRowProps) => {
  const {
    sectionId,
    node,
    level,
    expandedNodeIds,
    activeNodeId,
    rowVariant,
    nodeGap,
    linkComponent: LinkComponent,
    tabIndex,
    onFocus,
    onNavigate,
    onToggleNode,
    onMoveNode,
  } = props;

  if (node.inlineInput) {
    return <TreeListInlineInputRow input={node.inlineInput} icon={node.icon} level={level} />;
  }

  const hasChildren = hasExpandableChildren(node);
  const expanded = hasChildren && isInList(node.id, expandedNodeIds);
  const isActive = isActiveNode(node.id, activeNodeId);
  const isDisabled = node.disabled === true;
  const isNavigable = isNavigableNode(node);
  const canLink = Boolean(LinkComponent && node.href && isNavigable && !hasChildren && !isDisabled);

  const handleActivate = () => {
    if (isDisabled) return;
    if (hasChildren) {
      onToggleNode?.(node.id);
      return;
    }
    if (isNavigable && onNavigate) {
      onNavigate({ sectionId, nodeId: node.id, node, intent: node.navigationIntent });
      return;
    }
    node.onActivate?.();
  };

  const handleDragStart = (event: ReactDragEvent<HTMLElement>) => {
    writeDraggedTreeNodeId(event.dataTransfer, node.id);
    event.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (event: ReactDragEvent<HTMLElement>) => {
    if (!onMoveNode) return;
    event.stopPropagation();
    if (!node.canDrop) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (event: ReactDragEvent<HTMLElement>) => {
    if (!onMoveNode) return;
    event.stopPropagation();
    if (!node.canDrop) return;
    event.preventDefault();
    const sourceNodeId = readDraggedTreeNodeId(event.dataTransfer);
    if (sourceNodeId && sourceNodeId !== node.id) onMoveNode(sourceNodeId, node.id);
  };

  const rowItem: TreeListNode = {
    ...node,
    actions: node.actions?.map((action) => ({
      ...action,
      onAction: action.onAction
        ? (context) => action.onAction?.({ sectionId, nodeId: node.id, ...context })
        : undefined,
    })),
  };
  const { inlineInput: _inlineInput, rowVariant: nodeRowVariant, ...listRowItem } = rowItem;

  const rowProps = {
    ...listRowItem,
    depth: level,
    variant: nodeRowVariant ?? rowVariant,
    isSelected: isActive,
    isExpanded: expanded,
    showExpandToggle: hasChildren,
    tabIndex,
    "data-tree-list-focus-id": node.id,
    "aria-level": level + 1,
    "aria-expanded": hasChildren ? expanded : undefined,
    "data-tree-list-node-id": node.id,
    onFocus,
    onActivate: handleActivate,
    onToggleExpand: () => onToggleNode?.(node.id),
  };

  const row =
    canLink && LinkComponent && node.href ? (
      <LinkComponent to={node.href}>
        <ListRow {...rowProps} asChild />
      </LinkComponent>
    ) : (
      <ListRow {...rowProps} />
    );

  return (
    <Stack
      gap={nodeGap}
      w="full"
      minW="0"
      maxW="full"
      draggable={Boolean(onMoveNode && node.canDrag)}
      onDragStart={node.canDrag ? handleDragStart : undefined}
      onDragOver={onMoveNode ? handleDragOver : undefined}
      onDrop={onMoveNode ? handleDrop : undefined}
    >
      {row}
    </Stack>
  );
};
