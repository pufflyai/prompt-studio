import { Box, Flex, Text } from "@chakra-ui/react";
import { ScrollArea, TreeList } from "@pstdio/ui";
import { useEffect, useRef, useState } from "react";
import type { ResourceRef, TreeNode, TreeViewSection, TreeViewState, WorkbenchCore } from "../../core";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { findNodeInSections, resolveTreeListActiveNodeId, toTreeListSection } from "./tree-list-adapter";
import { TreeViewBody } from "./tree-view-body";
import { loadTreeSections } from "./tree-view-load";

interface WorkbenchTreeViewProps {
  workbench: WorkbenchCore;
  treeViewId: string;
  footerTreeViewId?: string;
  activeNodeId?: string | null;
  onOpenResourceError?: (error: unknown) => void;
}

const EMPTY_TREE_STATE: TreeViewState = { expandedNodeIds: [], expandedSectionIds: [] };

export const WorkbenchTreeView = (props: WorkbenchTreeViewProps) => {
  const { workbench, treeViewId, footerTreeViewId, activeNodeId, onOpenResourceError } = props;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const treeView = workbench.trees.getTreeView(treeViewId);
  const footerTreeView = footerTreeViewId ? workbench.trees.getTreeView(footerTreeViewId) : undefined;
  const treeState =
    useWorkbenchStore(workbench.trees.store, (state) => state.statesByViewId[treeViewId]) ?? EMPTY_TREE_STATE;
  const footerTreeState =
    useWorkbenchStore(workbench.trees.store, (state) =>
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
      void loadTreeSections(workbench.trees, treeViewId).then((nextSections) => {
        if (cancelled) return;
        if (!nextSections) {
          setSections([]);
          setChildrenByNodeId({});
          setLoading(false);
          return;
        }
        setSections(nextSections);
        setChildrenByNodeId({});
        setLoading(false);
      });
    };

    loadTree();
    const disposable = workbench.trees.onDidRefresh((event) => {
      if (event.treeViewId === treeViewId) loadTree();
    });

    return () => {
      cancelled = true;
      disposable.dispose();
    };
  }, [workbench, treeViewId]);

  useEffect(() => {
    if (!footerTreeViewId) {
      setFooterSections([]);
      setFooterLoading(false);
      return;
    }

    let cancelled = false;

    const loadFooterTree = () => {
      setFooterLoading(true);
      void loadTreeSections(workbench.trees, footerTreeViewId).then((nextSections) => {
        if (cancelled) return;
        if (!nextSections) {
          setFooterSections([]);
          setFooterLoading(false);
          return;
        }
        setFooterSections(nextSections);
        setFooterLoading(false);
      });
    };

    loadFooterTree();
    const disposable = workbench.trees.onDidRefresh((event) => {
      if (event.treeViewId === footerTreeViewId) loadFooterTree();
    });

    return () => {
      cancelled = true;
      disposable.dispose();
    };
  }, [footerTreeViewId, workbench]);

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

    workbench.trees.setNodeExpanded(sourceTreeViewId, nodeId, !expanded);

    if (expanded || childrenByNodeId[nodeId]) return;
    if (node.children) return;

    void workbench.trees.getChildren(sourceTreeViewId, node).then((children) => {
      setChildrenByNodeId((current) => ({ ...current, [nodeId]: children }));
    });
  };

  const toggleSection = (treeId: string, sectionId: string) => {
    const state = treeId === treeViewId ? treeState : footerTreeState;
    const expanded = state.expandedSectionIds.includes(sectionId);

    workbench.trees.setSectionExpanded(treeId, sectionId, !expanded);
  };

  const openResource = (treeId: string, nodeId: string, resource: ResourceRef) => {
    workbench.trees.setSelectedNode(treeId, nodeId);

    void workbench.resources.openResource(resource, { replaceActive: true }).catch(onOpenResourceError);
  };

  const treeSections = sections.map((section) =>
    toTreeListSection(section, childrenByNodeId, { workbench, onCommandError: onOpenResourceError }),
  );
  const footerTreeSections = footerSections.map((section) =>
    toTreeListSection(section, childrenByNodeId, { workbench, onCommandError: onOpenResourceError }),
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
