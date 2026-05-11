import { Box, HStack, IconButton, Menu, Stack, type StackProps, Text } from "@chakra-ui/react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ChevronRight } from "lucide-react";
import type { RefObject } from "react";
import { ListRow } from "../list-row/list-row";
import { SearchableActionMenu } from "../list-row/searchable-action-menu";
import type {
  TreeListAction,
  TreeListLinkComponent,
  TreeListNavigateEvent,
  TreeListNode,
  TreeListSection,
} from "./tree-list.types";

type TreeListRowVariant = "compact" | "tree";

interface TreeListProps {
  sections: TreeListSection[];
  expandedSectionIds?: string[];
  expandedNodeIds?: string[];
  activeNodeId?: string | string[] | null;
  rowVariant?: TreeListRowVariant;
  sectionGap?: StackProps["gap"];
  nodeGap?: StackProps["gap"];
  linkComponent?: TreeListLinkComponent;
  onNavigate?: (event: TreeListNavigateEvent) => void;
  onToggleSection?: (sectionId: string) => void;
  onToggleNode?: (nodeId: string) => void;
  /**
   * When set, the tree's rows are virtualized via @tanstack/react-virtual.
   * Requires `scrollRef` to point at the ancestor scroll viewport. Sections must
   * contain flat nodes (no expandable children) — nested rows are not virtualized.
   */
  virtualize?: boolean;
  scrollRef?: RefObject<HTMLDivElement | null>;
}

const VIRTUAL_ROW_ESTIMATE = 32;
const VIRTUAL_ROW_OVERSCAN = 8;

interface TreeListNodeRowProps {
  sectionId: string;
  node: TreeListNode;
  level: number;
  expandedNodeIds: string[];
  activeNodeId?: string | string[] | null;
  rowVariant: TreeListRowVariant;
  nodeGap: StackProps["gap"];
  linkComponent?: TreeListLinkComponent;
  onNavigate?: (event: TreeListNavigateEvent) => void;
  onToggleNode?: (nodeId: string) => void;
}

const isInList = (id: string, values: string[]) => values.includes(id);

const isActiveNode = (id: string, activeNodeId?: string | string[] | null) =>
  Array.isArray(activeNodeId) ? activeNodeId.includes(id) : activeNodeId === id;

const isNavigableNode = (node: TreeListNode) => node.isNavigable || node.navigationIntent !== undefined;

const getNodeChildren = (node: TreeListNode): TreeListNode[] => (node.children as TreeListNode[] | undefined) ?? [];

const hasExpandableChildren = (node: TreeListNode) => getNodeChildren(node).length > 0 || node.isContainer === true;

const TreeListNodeRow = (props: TreeListNodeRowProps) => {
  const {
    sectionId,
    node,
    level,
    expandedNodeIds,
    activeNodeId,
    rowVariant,
    nodeGap,
    linkComponent: LinkComponent,
    onNavigate,
    onToggleNode,
  } = props;

  const children = getNodeChildren(node);
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

  const row =
    canLink && LinkComponent && node.href ? (
      <LinkComponent to={node.href}>
        <ListRow
          {...rowItem}
          depth={level}
          variant={rowVariant}
          isSelected={isActive}
          isExpanded={expanded}
          showExpandToggle={hasChildren}
          onActivate={handleActivate}
          onToggleExpand={() => onToggleNode?.(node.id)}
          asChild
        />
      </LinkComponent>
    ) : (
      <ListRow
        {...rowItem}
        depth={level}
        variant={rowVariant}
        isSelected={isActive}
        isExpanded={expanded}
        showExpandToggle={hasChildren}
        onActivate={handleActivate}
        onToggleExpand={() => onToggleNode?.(node.id)}
      />
    );

  return (
    <Stack gap={nodeGap} w="full" minW="0" maxW="full">
      {row}
      {expanded && children.length > 0
        ? children.map((childNode) => (
            <TreeListNodeRow
              key={childNode.id}
              sectionId={sectionId}
              node={childNode}
              level={level + 1}
              expandedNodeIds={expandedNodeIds}
              activeNodeId={activeNodeId}
              rowVariant={rowVariant}
              nodeGap={nodeGap}
              linkComponent={LinkComponent}
              onNavigate={onNavigate}
              onToggleNode={onToggleNode}
            />
          ))
        : null}
    </Stack>
  );
};

interface TreeListSectionActionsProps {
  sectionId: string;
  actions: TreeListAction[];
}

const TreeListSectionActions = (props: TreeListSectionActionsProps) => {
  const { sectionId, actions } = props;
  if (actions.length === 0) return null;

  return (
    <HStack
      gap="0"
      opacity="0"
      pointerEvents="none"
      _groupHover={{ opacity: "1", pointerEvents: "auto" }}
      _groupFocusWithin={{ opacity: "1", pointerEvents: "auto" }}
      transition="opacity 120ms ease"
      onClick={(event) => event.stopPropagation()}
    >
      {actions.map((action) => {
        if (action.menuItems && action.menuItems.length >= 8) {
          return <SearchableActionMenu key={action.id} action={action} />;
        }
        if (action.menuItems && action.menuItems.length > 0) {
          return (
            <Menu.Root key={action.id}>
              <Menu.Trigger asChild>
                <IconButton variant="ghost" size="2xs" aria-label={action.label}>
                  {action.icon}
                </IconButton>
              </Menu.Trigger>
              <Menu.Positioner>
                <Menu.Content minW="160px" bg="bg">
                  {action.menuItems.map((item) => (
                    <Menu.Item key={item.id} value={item.id} disabled={item.disabled} onClick={() => item.onAction?.()}>
                      {item.label}
                    </Menu.Item>
                  ))}
                </Menu.Content>
              </Menu.Positioner>
            </Menu.Root>
          );
        }
        return (
          <IconButton
            key={action.id}
            variant="ghost"
            size="2xs"
            aria-label={action.label}
            onClick={(event) => {
              event.stopPropagation();
              action.onAction?.({ sectionId });
            }}
          >
            {action.icon}
          </IconButton>
        );
      })}
    </HStack>
  );
};

interface TreeListSectionHeaderProps {
  section: TreeListSection;
  collapsible: boolean;
  expanded: boolean;
  onToggle: () => void;
}

const TreeListSectionHeader = (props: TreeListSectionHeaderProps) => {
  const { section, collapsible, expanded, onToggle } = props;

  return (
    <HStack
      className="group"
      justify="space-between"
      align="center"
      w="full"
      minW="0"
      maxW="full"
      px="sm"
      py="2xs"
      height="7"
      cursor={collapsible ? "pointer" : "default"}
      _hover={collapsible ? { bg: "bg.hover" } : undefined}
      onClick={collapsible ? onToggle : undefined}
    >
      <HStack gap="1" flex="1" minW="0">
        <Text textStyle="label/XS" textTransform="uppercase" color="fg.muted" letterSpacing="0.08em" truncate>
          {section.label}
        </Text>
        {collapsible ? (
          <Box color="fg.muted" flexShrink={0}>
            <ChevronRight
              size={14}
              style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)", transition: "120ms" }}
            />
          </Box>
        ) : null}
      </HStack>
      <TreeListSectionActions sectionId={section.id} actions={section.actions ?? []} />
    </HStack>
  );
};

type VirtualRow =
  | {
      kind: "section-header";
      key: string;
      sectionId: string;
      section: TreeListSection;
      collapsible: boolean;
      expanded: boolean;
    }
  | { kind: "node"; key: string; sectionId: string; node: TreeListNode }
  | { kind: "section-empty"; key: string; sectionId: string; emptyState: TreeListSection["emptyState"] };

const buildVirtualRows = (sections: TreeListSection[], expandedSectionIds: string[]): VirtualRow[] => {
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
    for (const node of section.nodes) {
      rows.push({ kind: "node", key: `${section.id}:${node.id}`, sectionId: section.id, node });
    }
  }
  return rows;
};

interface VirtualTreeListProps extends TreeListProps {
  scrollRef: RefObject<HTMLDivElement | null>;
}

const VirtualTreeList = (props: VirtualTreeListProps) => {
  const {
    sections,
    expandedSectionIds = [],
    expandedNodeIds = [],
    activeNodeId,
    rowVariant = "tree",
    nodeGap = "0",
    linkComponent,
    onNavigate,
    onToggleSection,
    onToggleNode,
    scrollRef,
  } = props;

  const rows = buildVirtualRows(sections, expandedSectionIds);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => VIRTUAL_ROW_ESTIMATE,
    overscan: VIRTUAL_ROW_OVERSCAN,
    getItemKey: (index) => rows[index]?.key ?? index,
  });

  return (
    <Box
      role="listbox"
      w="full"
      minW="0"
      maxW="full"
      position="relative"
      style={{ height: virtualizer.getTotalSize() }}
    >
      {virtualizer.getVirtualItems().map((virtualItem) => {
        const row = rows[virtualItem.index];
        if (!row) return null;

        const content =
          row.kind === "section-header" ? (
            <TreeListSectionHeader
              section={row.section}
              collapsible={row.collapsible}
              expanded={row.expanded}
              onToggle={() => onToggleSection?.(row.sectionId)}
            />
          ) : row.kind === "section-empty" ? (
            (row.emptyState ?? null)
          ) : (
            <TreeListNodeRow
              sectionId={row.sectionId}
              node={row.node}
              level={0}
              expandedNodeIds={expandedNodeIds}
              activeNodeId={activeNodeId}
              rowVariant={rowVariant}
              nodeGap={nodeGap}
              linkComponent={linkComponent}
              onNavigate={onNavigate}
              onToggleNode={onToggleNode}
            />
          );

        return (
          <Box
            key={virtualItem.key}
            ref={virtualizer.measureElement}
            data-index={virtualItem.index}
            data-tree-list-row={row.kind}
            position="absolute"
            top="0"
            left="0"
            w="full"
            style={{ transform: `translateY(${virtualItem.start}px)` }}
          >
            {content}
          </Box>
        );
      })}
    </Box>
  );
};

export const TreeList = (props: TreeListProps) => {
  const {
    sections,
    expandedSectionIds = [],
    expandedNodeIds = [],
    activeNodeId,
    rowVariant = "tree",
    sectionGap = "0",
    nodeGap = "0",
    linkComponent,
    onNavigate,
    onToggleSection,
    onToggleNode,
    virtualize,
    scrollRef,
  } = props;

  if (virtualize && scrollRef) {
    return <VirtualTreeList {...props} scrollRef={scrollRef} />;
  }

  return (
    <Stack role="listbox" gap={sectionGap} w="full" minW="0" maxW="full" overflowX="hidden">
      {sections.map((section) => {
        const collapsible = section.collapsible !== false && section.label !== undefined;
        const sectionExpanded = collapsible ? isInList(section.id, expandedSectionIds) : true;

        return (
          <Stack key={section.id} gap="0" w="full" minW="0" maxW="full" data-testid={`tree-list-section-${section.id}`}>
            {section.label ? (
              <TreeListSectionHeader
                section={section}
                collapsible={collapsible}
                expanded={sectionExpanded}
                onToggle={() => onToggleSection?.(section.id)}
              />
            ) : null}

            {sectionExpanded ? (
              section.nodes.length > 0 ? (
                <Stack gap={nodeGap} w="full" minW="0" maxW="full">
                  {section.nodes.map((node) => (
                    <TreeListNodeRow
                      key={node.id}
                      sectionId={section.id}
                      node={node}
                      level={0}
                      expandedNodeIds={expandedNodeIds}
                      activeNodeId={activeNodeId}
                      rowVariant={rowVariant}
                      nodeGap={nodeGap}
                      linkComponent={linkComponent}
                      onNavigate={onNavigate}
                      onToggleNode={onToggleNode}
                    />
                  ))}
                </Stack>
              ) : (
                (section.emptyState ?? null)
              )
            ) : null}
          </Stack>
        );
      })}
    </Stack>
  );
};
