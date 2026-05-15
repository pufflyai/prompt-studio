import { Box, Flex, Skeleton, Stack, Text } from "@chakra-ui/react";
import { EmptyState, ScrollArea, Tooltip, TreeList, type TreeListNode, type TreeListSection } from "@pstdio/ui";
import { type ReactNode, type RefObject, useEffect, useRef, useState } from "react";
import type { ResourceRef, ShellCore, TreeNode, TreeViewSection, TreeViewState } from "../../core";
import { ShellIcon } from "../shared/icon";
import { useShellStore } from "../shared/use-shell-store";
import { createTreeActionItems, createTreeContextMenuItems, createTreeMenuItems } from "./tree-actions";

interface ShellTreeViewProps {
  shell: ShellCore;
  treeViewId: string;
  footerTreeViewId?: string;
  activeNodeId?: string | null;
  onOpenResourceError?: (error: unknown) => void;
}

const EMPTY_TREE_STATE: TreeViewState = { expandedNodeIds: [], expandedSectionIds: [] };

const TREE_SKELETON_WIDTHS = ["70%", "50%", "82%", "60%", "44%", "76%"];

const TreeViewSkeleton = () => (
  <Stack gap="sm" px="sm" py="xs" aria-hidden>
    {TREE_SKELETON_WIDTHS.map((width, index) => (
      <Skeleton key={`${width}-${index}`} height="4" width={width} borderRadius="xs" />
    ))}
  </Stack>
);

interface TreeViewBodyProps {
  loading: boolean;
  moduleLoading?: boolean;
  sections: TreeListSection[];
  activeNodeId: string | string[] | undefined;
  expandedNodeIds: string[];
  expandedSectionIds: string[];
  scrollRef: RefObject<HTMLDivElement | null>;
  onToggleSection: (sectionId: string) => void;
  onToggleNode: (nodeId: string) => void;
  onNavigate: (event: Parameters<NonNullable<Parameters<typeof TreeList>[0]["onNavigate"]>>[0]) => void;
}

const TreeViewBody = (props: TreeViewBodyProps) => {
  const {
    loading,
    moduleLoading,
    sections,
    activeNodeId,
    expandedNodeIds,
    expandedSectionIds,
    scrollRef,
    onToggleSection,
    onToggleNode,
    onNavigate,
  } = props;

  if (loading) return null;
  if (moduleLoading) return <TreeViewSkeleton />;

  if (sections.length === 0) return <EmptyState minH="12rem" title="No tree items" />;

  return (
    <TreeList
      sections={sections}
      expandedNodeIds={expandedNodeIds}
      expandedSectionIds={expandedSectionIds}
      activeNodeId={activeNodeId}
      rowVariant="compact"
      sectionGap="md"
      virtualize={canVirtualizeTreeSections(sections)}
      scrollRef={scrollRef}
      onToggleSection={onToggleSection}
      onToggleNode={onToggleNode}
      onNavigate={onNavigate}
    />
  );
};

export const resolveTreeListActiveNodeId = (activeNodeId: string | null | undefined, selectedNodeId?: string) => {
  if (!activeNodeId) return selectedNodeId;
  if (!selectedNodeId || selectedNodeId === activeNodeId) return activeNodeId;

  return [activeNodeId, selectedNodeId];
};

const canVirtualizeTreeNode = (node: TreeListNode) => node.isContainer !== true && (node.children ?? []).length === 0;

export const canVirtualizeTreeSections = (sections: TreeListSection[]) =>
  sections.every((section) => section.nodes.every(canVirtualizeTreeNode));

const findNode = (nodes: TreeNode[], nodeId: string, childrenByNodeId: Record<string, TreeNode[]>): TreeNode | null => {
  for (const node of nodes) {
    if (node.id === nodeId) return node;
    const child = findNode([...(node.children ?? []), ...(childrenByNodeId[node.id] ?? [])], nodeId, childrenByNodeId);
    if (child) return child;
  }

  return null;
};

const findNodeInSections = (
  sections: TreeViewSection[],
  nodeId: string,
  childrenByNodeId: Record<string, TreeNode[]>,
) => {
  for (const section of sections) {
    const node = findNode(section.nodes, nodeId, childrenByNodeId);
    if (node) return node;
  }

  return null;
};

interface TreeNodeRenderContext {
  shell: ShellCore;
  onCommandError?: (error: unknown) => void;
}

const wrapTreeNodeIcon = (icon: ReactNode, iconTooltip: string | undefined) => {
  if (!iconTooltip) return icon;

  return (
    <Tooltip content={iconTooltip} openDelay={300}>
      <Box as="span" display="inline-flex" alignItems="center" justifyContent="center">
        {icon}
      </Box>
    </Tooltip>
  );
};

const resolveTreeNodeIcon = (node: TreeNode): ReactNode | undefined => {
  let icon: ReactNode | undefined;
  if (node.iconElement !== undefined) {
    icon = node.iconElement as ReactNode;
  } else if (node.icon) {
    icon = <ShellIcon name={node.icon} />;
  }

  return icon === undefined ? undefined : wrapTreeNodeIcon(icon, node.iconTooltip);
};

const toTreeListNode = (
  node: TreeNode,
  childrenByNodeId: Record<string, TreeNode[]>,
  context: TreeNodeRenderContext,
) => {
  const menuItems = node.menuPath
    ? createTreeMenuItems({
        shell: context.shell,
        menuPath: node.menuPath,
        onCommandError: context.onCommandError,
      })
    : undefined;
  const contextMenuItems = createTreeContextMenuItems({
    actions: node.contextMenuActions,
    menuPath: node.contextMenuPath,
    shell: context.shell,
    onCommandError: context.onCommandError,
  });

  const treeNode: TreeListNode = {
    id: node.id,
    label: node.label,
    description: node.description,
    icon: resolveTreeNodeIcon(node),
    iconColor: node.iconColor,
    disabled: node.disabled,
    actions: createTreeActionItems({
      actions: node.actions,
      shell: context.shell,
      onCommandError: context.onCommandError,
    }),
    endContent: menuItems && menuItems.length > 0 ? <ShellIcon name="ChevronRight" size={12} /> : undefined,
    menuItems,
    contextMenuItems: contextMenuItems.length > 0 ? contextMenuItems : undefined,
    ...(node.menuPlacement ? { menuPlacement: node.menuPlacement } : {}),
    isContainer: node.collapsible,
    isNavigable: Boolean(node.resource),
    navigationIntent: node.resource ? { id: node.id, payload: node.resource } : undefined,
    children: [...(node.children ?? []), ...(childrenByNodeId[node.id] ?? [])].map((child) =>
      toTreeListNode(child, childrenByNodeId, context),
    ),
  } as TreeListNode;

  return treeNode;
};

const toTreeListSection = (
  section: TreeViewSection,
  childrenByNodeId: Record<string, TreeNode[]>,
  context: TreeNodeRenderContext,
): TreeListSection => ({
  id: section.id,
  label: section.label,
  actions: createTreeActionItems({
    actions: section.actions,
    shell: context.shell,
    onCommandError: context.onCommandError,
  }),
  collapsible: section.collapsible,
  nodes: section.nodes.map((node) => toTreeListNode(node, childrenByNodeId, context)),
});

export const ShellTreeView = (props: ShellTreeViewProps) => {
  const { shell, treeViewId, footerTreeViewId, activeNodeId, onOpenResourceError } = props;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const treeView = shell.trees.getTreeView(treeViewId);
  const footerTreeView = footerTreeViewId ? shell.trees.getTreeView(footerTreeViewId) : undefined;
  const treeState = useShellStore(shell.trees.store, (state) => state.statesByViewId[treeViewId]) ?? EMPTY_TREE_STATE;
  const footerTreeState =
    useShellStore(shell.trees.store, (state) =>
      footerTreeViewId ? state.statesByViewId[footerTreeViewId] : undefined,
    ) ?? EMPTY_TREE_STATE;
  const [sections, setSections] = useState<TreeViewSection[]>([]);
  const [footerSections, setFooterSections] = useState<TreeViewSection[]>([]);
  const [childrenByNodeId, setChildrenByNodeId] = useState<Record<string, TreeNode[]>>({});
  const [loading, setLoading] = useState(true);
  const [footerLoading, setFooterLoading] = useState(Boolean(footerTreeViewId));

  useEffect(() => {
    let cancelled = false;

    const loadTree = () => {
      setLoading(true);
      void shell.trees.getSections(treeViewId).then((nextSections) => {
        if (cancelled) return;
        setSections(nextSections);
        setChildrenByNodeId({});
        setLoading(false);
      });
    };

    loadTree();
    const disposable = shell.trees.onDidRefresh((event) => {
      if (event.treeViewId === treeViewId) loadTree();
    });

    return () => {
      cancelled = true;
      disposable.dispose();
    };
  }, [shell, treeViewId]);

  useEffect(() => {
    if (!footerTreeViewId) {
      setFooterSections([]);
      setFooterLoading(false);
      return;
    }

    let cancelled = false;

    const loadFooterTree = () => {
      setFooterLoading(true);
      void shell.trees.getSections(footerTreeViewId).then((nextSections) => {
        if (cancelled) return;
        setFooterSections(nextSections);
        setFooterLoading(false);
      });
    };

    loadFooterTree();
    const disposable = shell.trees.onDidRefresh((event) => {
      if (event.treeViewId === footerTreeViewId) loadFooterTree();
    });

    return () => {
      cancelled = true;
      disposable.dispose();
    };
  }, [footerTreeViewId, shell]);

  if (!treeView) {
    return (
      <Text textStyle="paragraph/S/regular" color="fg.muted" p="sm">
        Tree view is no longer registered.
      </Text>
    );
  }

  const toggleNode = (nodeId: string) => {
    const mainNode = findNodeInSections(sections, nodeId, childrenByNodeId);
    const footerNode = mainNode ? null : findNodeInSections(footerSections, nodeId, childrenByNodeId);
    const node = mainNode ?? footerNode;
    if (!node) return;

    const sourceTreeViewId = mainNode ? treeViewId : footerTreeViewId;
    if (!sourceTreeViewId) return;
    const expanded = (mainNode ? treeState : footerTreeState).expandedNodeIds.includes(nodeId);

    shell.trees.setNodeExpanded(sourceTreeViewId, nodeId, !expanded);

    if (expanded || childrenByNodeId[nodeId]) return;
    if (node.children) return;

    void shell.trees.getChildren(sourceTreeViewId, node).then((children) => {
      setChildrenByNodeId((current) => ({ ...current, [nodeId]: children }));
    });
  };

  const toggleSection = (treeId: string, sectionId: string) => {
    const state = treeId === treeViewId ? treeState : footerTreeState;
    const expanded = state.expandedSectionIds.includes(sectionId);

    shell.trees.setSectionExpanded(treeId, sectionId, !expanded);
  };

  const openResource = (treeId: string, nodeId: string, resource: ResourceRef) => {
    shell.trees.setSelectedNode(treeId, nodeId);

    void shell.resources.openResource(resource, { replaceActive: true }).catch(onOpenResourceError);
  };

  const treeSections = sections.map((section) =>
    toTreeListSection(section, childrenByNodeId, { shell, onCommandError: onOpenResourceError }),
  );
  const footerTreeSections = footerSections.map((section) =>
    toTreeListSection(section, childrenByNodeId, { shell, onCommandError: onOpenResourceError }),
  );

  return (
    <Flex as="section" direction="column" h="full" minH="0" minW="0" aria-label={treeView.title}>
      <ScrollArea
        flex="1"
        mt="lg"
        minH="0"
        w="full"
        viewportRef={scrollRef}
        viewportProps={{ display: "block", style: { overflowX: "hidden" } }}
        contentProps={{ style: { minWidth: "100%", width: "100%" } }}
      >
        <Box w="full" minW="0">
          <TreeViewBody
            loading={loading}
            moduleLoading={treeState.loading}
            sections={treeSections}
            activeNodeId={resolveTreeListActiveNodeId(activeNodeId, treeState.selectedNodeId)}
            expandedNodeIds={treeState.expandedNodeIds}
            expandedSectionIds={treeState.expandedSectionIds}
            scrollRef={scrollRef}
            onToggleSection={(sectionId) => toggleSection(treeViewId, sectionId)}
            onToggleNode={toggleNode}
            onNavigate={(event) => {
              const resource = event.intent?.payload;
              if (!resource || typeof resource !== "object") return;
              openResource(treeViewId, event.nodeId, resource as ResourceRef);
            }}
          />
        </Box>
      </ScrollArea>
      {footerTreeView && !footerLoading && footerTreeSections.length > 0 ? (
        <Flex bg="bg" flexShrink={0}>
          <TreeList
            sections={footerTreeSections}
            expandedNodeIds={footerTreeState.expandedNodeIds}
            expandedSectionIds={footerTreeState.expandedSectionIds}
            activeNodeId={resolveTreeListActiveNodeId(activeNodeId, footerTreeState.selectedNodeId)}
            rowVariant="compact"
            onToggleSection={(sectionId) => footerTreeViewId && toggleSection(footerTreeViewId, sectionId)}
            onToggleNode={toggleNode}
            onNavigate={(event) => {
              const resource = event.intent?.payload;
              if (!resource || typeof resource !== "object") return;
              if (!footerTreeViewId) return;
              openResource(footerTreeViewId, event.nodeId, resource as ResourceRef);
            }}
          />
        </Flex>
      ) : null}
    </Flex>
  );
};
