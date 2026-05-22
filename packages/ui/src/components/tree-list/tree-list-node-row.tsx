import type { StackProps } from "@chakra-ui/react";
import { Stack } from "@chakra-ui/react";
import type { FocusEventHandler } from "react";
import { ListRow } from "../list-row/list-row";
import type { TreeListLinkComponent, TreeListNavigateEvent, TreeListNode } from "./tree-list.types";
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
  } = props;

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

  const rowItem: TreeListNode = {
    ...node,
    actions: node.actions?.map((action) => ({
      ...action,
      onAction: action.onAction
        ? (context) => action.onAction?.({ sectionId, nodeId: node.id, ...context })
        : undefined,
    })),
  };

  const rowProps = {
    ...rowItem,
    depth: level,
    variant: rowVariant,
    isSelected: isActive,
    isExpanded: expanded,
    showExpandToggle: hasChildren,
    tabIndex,
    "data-tree-list-focus-id": node.id,
    "aria-level": level + 1,
    "aria-expanded": hasChildren ? expanded : undefined,
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
    <Stack gap={nodeGap} w="full" minW="0" maxW="full">
      {row}
    </Stack>
  );
};
