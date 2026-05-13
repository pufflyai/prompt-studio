import { Box, Flex, Text } from "@chakra-ui/react";
import { EmptyState, ScrollArea, TreeList, type TreeListNode, type TreeListSection } from "@pstdio/ui";
import { useEffect, useState } from "react";
import type { ResourceRef, ShellCore, TreeNode, TreeViewSection, TreeViewState } from "../core";
import { ShellIcon } from "./shell-icons";
import { createTreeActionItems, createTreeMenuItems } from "./shell-tree-actions";

interface ShellTreeViewProps {
  shell: ShellCore;
  treeViewId: string;
  footerTreeViewId?: string;
  activeNodeId?: string | null;
  refresh?: () => void;
  onOpenResourceError?: (error: unknown) => void;
}

const EMPTY_TREE_STATE: TreeViewState = { expandedNodeIds: [], expandedSectionIds: [] };

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
  refresh: () => void;
  onCommandError?: (error: unknown) => void;
}

const toTreeListNode = (
  node: TreeNode,
  childrenByNodeId: Record<string, TreeNode[]>,
  context: TreeNodeRenderContext,
) => {
  const menuItems = node.menuPath
    ? createTreeMenuItems({
        shell: context.shell,
        menuPath: node.menuPath,
        refresh: context.refresh,
        onCommandError: context.onCommandError,
      })
    : undefined;

  const treeNode: TreeListNode = {
    id: node.id,
    label: node.label,
    description: node.description,
    icon: <ShellIcon name={node.icon} />,
    actions: createTreeActionItems({
      actions: node.actions,
      shell: context.shell,
      refresh: context.refresh,
      onCommandError: context.onCommandError,
    }),
    endContent: menuItems && menuItems.length > 0 ? <ShellIcon name="ChevronRight" size={12} /> : undefined,
    menuItems,
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
    refresh: context.refresh,
    onCommandError: context.onCommandError,
  }),
  collapsible: section.collapsible,
  nodes: section.nodes.map((node) => toTreeListNode(node, childrenByNodeId, context)),
});

export const ShellTreeView = (props: ShellTreeViewProps) => {
  const { shell, treeViewId, footerTreeViewId, activeNodeId, refresh = () => undefined, onOpenResourceError } = props;
  const treeView = shell.trees.getTreeView(treeViewId);
  const footerTreeView = footerTreeViewId ? shell.trees.getTreeView(footerTreeViewId) : undefined;
  const [sections, setSections] = useState<TreeViewSection[]>([]);
  const [footerSections, setFooterSections] = useState<TreeViewSection[]>([]);
  const [childrenByNodeId, setChildrenByNodeId] = useState<Record<string, TreeNode[]>>({});
  const [treeState, setTreeState] = useState<TreeViewState>(EMPTY_TREE_STATE);
  const [footerTreeState, setFooterTreeState] = useState<TreeViewState>(EMPTY_TREE_STATE);
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
        setTreeState(shell.trees.getViewState(treeViewId));
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
      setFooterTreeState(EMPTY_TREE_STATE);
      setFooterLoading(false);
      return;
    }

    let cancelled = false;

    const loadFooterTree = () => {
      setFooterLoading(true);
      void shell.trees.getSections(footerTreeViewId).then((nextSections) => {
        if (cancelled) return;
        setFooterSections(nextSections);
        setFooterTreeState(shell.trees.getViewState(footerTreeViewId));
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
    if (mainNode) {
      setTreeState(shell.trees.getViewState(sourceTreeViewId));
    } else {
      setFooterTreeState(shell.trees.getViewState(sourceTreeViewId));
    }

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
    if (treeId === treeViewId) {
      setTreeState(shell.trees.getViewState(treeId));
    } else {
      setFooterTreeState(shell.trees.getViewState(treeId));
    }
  };

  const openResource = (treeId: string, nodeId: string, resource: ResourceRef) => {
    shell.trees.setSelectedNode(treeId, nodeId);
    if (treeId === treeViewId) {
      setTreeState(shell.trees.getViewState(treeId));
    } else {
      setFooterTreeState(shell.trees.getViewState(treeId));
    }

    void shell.resources.openResource(resource, { replaceActive: true }).then(refresh).catch(onOpenResourceError);
  };

  const treeSections = sections.map((section) =>
    toTreeListSection(section, childrenByNodeId, { shell, refresh, onCommandError: onOpenResourceError }),
  );
  const footerTreeSections = footerSections.map((section) =>
    toTreeListSection(section, childrenByNodeId, { shell, refresh, onCommandError: onOpenResourceError }),
  );

  return (
    <Flex as="section" direction="column" h="full" minH="0" minW="0" aria-label={treeView.title}>
      <ScrollArea
        flex="1"
        mt="lg"
        minH="0"
        w="full"
        viewportProps={{ display: "block", style: { overflowX: "hidden" } }}
        contentProps={{ style: { minWidth: "100%", width: "100%" } }}
      >
        <Box w="full" minW="0">
          {loading ? (
            <Text textStyle="paragraph/S/regular" color="fg.muted" p="sm">
              Loading tree...
            </Text>
          ) : treeSections.length > 0 ? (
            <TreeList
              sections={treeSections}
              expandedNodeIds={treeState.expandedNodeIds}
              expandedSectionIds={treeState.expandedSectionIds}
              activeNodeId={activeNodeId ?? treeState.selectedNodeId}
              rowVariant="compact"
              sectionGap="md"
              onToggleSection={(sectionId) => toggleSection(treeViewId, sectionId)}
              onToggleNode={toggleNode}
              onNavigate={(event) => {
                const resource = event.intent?.payload;
                if (!resource || typeof resource !== "object") return;
                openResource(treeViewId, event.nodeId, resource as ResourceRef);
              }}
            />
          ) : (
            <EmptyState minH="12rem" title="No tree items" />
          )}
        </Box>
      </ScrollArea>
      {footerTreeView && !footerLoading && footerTreeSections.length > 0 ? (
        <Flex bg="bg" flexShrink={0}>
          <TreeList
            sections={footerTreeSections}
            expandedNodeIds={footerTreeState.expandedNodeIds}
            expandedSectionIds={footerTreeState.expandedSectionIds}
            activeNodeId={activeNodeId ?? footerTreeState.selectedNodeId}
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
