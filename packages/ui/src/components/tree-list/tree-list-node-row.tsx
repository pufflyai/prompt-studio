import type { StackProps } from "@chakra-ui/react";
import { Stack } from "@chakra-ui/react";
import { type FocusEventHandler, type DragEvent as ReactDragEvent, useState } from "react";
import { ListRow } from "../list-row/list-row";
import { DropIndicator } from "../primitives/drop-indicator";
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
  onMoveNode?: (sourceNodeId: string, targetNodeId?: string, position?: "before" | "after" | "inside") => void;
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
  const [dropPosition, setDropPosition] = useState<"before" | "after" | "inside" | null>(null);

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

  const positionAt = (event: ReactDragEvent<HTMLElement>) => {
    if (hasChildren) return "inside";
    const bounds = event.currentTarget.getBoundingClientRect();
    return event.clientY < bounds.top + bounds.height / 2 ? "before" : "after";
  };

  const handleDragOver = (event: ReactDragEvent<HTMLElement>) => {
    if (!onMoveNode) return;
    event.stopPropagation();
    if (!node.canDrop) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropPosition(positionAt(event));
  };

  const handleDrop = (event: ReactDragEvent<HTMLElement>) => {
    if (!onMoveNode) return;
    event.stopPropagation();
    if (!node.canDrop) return;
    event.preventDefault();
    setDropPosition(null);
    const sourceNodeId = readDraggedTreeNodeId(event.dataTransfer);
    if (sourceNodeId && sourceNodeId !== node.id) onMoveNode(sourceNodeId, node.id, positionAt(event));
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
      position="relative"
      bg={dropPosition === "inside" ? "bg.accent-subtle" : undefined}
      draggable={Boolean(onMoveNode && node.canDrag)}
      onDragStart={node.canDrag ? handleDragStart : undefined}
      onDragOver={onMoveNode ? handleDragOver : undefined}
      onDrop={onMoveNode ? handleDrop : undefined}
      onDragLeave={(event) => {
        if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget))
          setDropPosition(null);
      }}
    >
      {row}
      {dropPosition === "before" || dropPosition === "after" ? (
        <DropIndicator
          data-tree-list-drop-indicator={dropPosition}
          {...(dropPosition === "before"
            ? { top: "0", transform: "translateY(-50%)" }
            : { bottom: "0", transform: "translateY(50%)" })}
        />
      ) : null}
    </Stack>
  );
};
