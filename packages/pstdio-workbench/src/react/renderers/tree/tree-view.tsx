import { Box, Flex, Text } from "@chakra-ui/react";
import { ScrollArea, TreeList } from "@pstdio/ui";
import { useEffect, useRef, useState } from "react";
import type {
  NavigationTarget,
  ResourceRef,
  TreeNode,
  TreeRendererState,
  TreeViewSection,
  WorkbenchCore,
} from "../../../core";
import { getAnchorResource } from "../../../core";
import type { CommandParamFieldRenderer } from "../../command-palette/command-params-dialog";
import { CommandParamsDialog } from "../../command-palette/command-params-dialog";
import { WorkbenchIcon } from "../../shared/icon";
import { useWorkbenchStore } from "../../shared/use-workbench-store";
import { workbenchBackgrounds } from "../../theme/workbench-theme-background";
import type { TreeActionParamsRequest } from "./tree-actions";
import { findNodeInSections, resolveTreeListSelection, toTreeListSection } from "./tree-list-adapter";
import { TreeViewBody } from "./tree-view-body";
import { expandDefaultTreeSections, loadTreeData, shouldShowTreeLoading } from "./tree-view-load";
import { shouldSelectTreeNodeForNavigationTarget } from "./tree-view-navigation";
import { useTreeViewCustomization } from "./use-tree-view-customization";

interface WorkbenchTreeViewProps {
  workbench: WorkbenchCore;
  treeViewId: string;
  activeNodeId?: string | null;
  resource?: ResourceRef;
  renderParamField?: CommandParamFieldRenderer;
  onOpenResourceError?: (error: unknown) => void;
}

const EMPTY_TREE_STATE: TreeRendererState = { expandedNodeIds: [], expandedSectionIds: [] };

const footerSection = (footer: TreeNode[]): TreeViewSection => ({ id: "__footer__", nodes: footer });

type WorkbenchLayoutState = ReturnType<WorkbenchCore["layout"]["getLayout"]>;

const resolveActivePlacement = (
  widgets: WorkbenchLayoutState["areas"]["overlay"]["widgets"],
  activeWidgetId: string | undefined,
) => widgets.find((entry) => entry.widgetId === activeWidgetId) ?? widgets[0];

const resolveTreeActiveResource = (layout: WorkbenchLayoutState) =>
  resolveActivePlacement(layout.areas.overlay.widgets, layout.areas.overlay.activeWidgetId)?.resource ??
  getAnchorResource(layout, "primary");

export const WorkbenchTreeView = (props: WorkbenchTreeViewProps) => {
  const { workbench, treeViewId, activeNodeId, resource, renderParamField, onOpenResourceError } = props;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const treeRenderer = workbench.renderers.getTreeRenderer(treeViewId);
  const treeState =
    useWorkbenchStore(workbench.renderers.treeStore, (state) => state.statesByTreeId[treeViewId]) ?? EMPTY_TREE_STATE;
  const activeResource = useWorkbenchStore(workbench.layout.store, (state) => resolveTreeActiveResource(state.layout));
  const [body, setBody] = useState<TreeViewSection[]>([]);
  const [footer, setFooter] = useState<TreeNode[]>([]);
  const [childrenByNodeId, setChildrenByNodeId] = useState<Record<string, TreeNode[]>>({});
  const [loading, setLoading] = useState(true);
  const [paramsRequest, setParamsRequest] = useState<TreeActionParamsRequest | null>(null);
  const loadedTreeIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    expandDefaultTreeSections(workbench.renderers, treeViewId);

    const loadTree = () => {
      // Reloads (selection or refresh) keep the current content visible so the
      // tree never blanks between items; only the first load shows the spinner.
      if (shouldShowTreeLoading(loadedTreeIdRef.current, treeViewId)) setLoading(true);
      void loadTreeData(workbench.renderers, treeViewId, { resource }).then((data) => {
        if (cancelled) return;
        loadedTreeIdRef.current = treeViewId;
        if (!data) {
          setBody([]);
          setFooter([]);
          setChildrenByNodeId({});
          setLoading(false);
          return;
        }
        setBody(data.body);
        setFooter(data.footer);
        setChildrenByNodeId({});
        setLoading(false);
      });
    };

    loadTree();
    const disposable = workbench.renderers.onDidRefresh((event) => {
      if (event.treeId === treeViewId) loadTree();
    });

    return () => {
      cancelled = true;
      disposable.dispose();
    };
  }, [resource, workbench, treeViewId]);

  const rawSections = body.map((section) =>
    toTreeListSection(section, childrenByNodeId, {
      workbench,
      onCommandError: onOpenResourceError,
      onRequestParams: setParamsRequest,
    }),
  );
  // Per-tree-view hide/show: persisted under the tree id so each tree customizes
  // independently. Hidden nodes drop out of the render; the menu still lists them.
  const { visibleSections, backgroundContextActions } = useTreeViewCustomization(
    treeViewId,
    rawSections,
    <WorkbenchIcon name="Check" size={12} />,
  );
  if (!treeRenderer) {
    return (
      <Text textStyle="paragraph/S/regular" color="fg.muted" p="sm">
        Tree renderer is no longer registered.
      </Text>
    );
  }

  const toggleNode = (nodeId: string) => {
    const node =
      findNodeInSections(body, nodeId, childrenByNodeId) ??
      findNodeInSections([footerSection(footer)], nodeId, childrenByNodeId);
    if (!node) return;

    const expanded = treeState.expandedNodeIds.includes(nodeId);

    workbench.renderers.setNodeExpanded(treeViewId, nodeId, !expanded);

    if (expanded || childrenByNodeId[nodeId]) return;
    if (node.children) return;

    void workbench.renderers.getChildren(treeViewId, node, { resource }).then((children) => {
      setChildrenByNodeId((current) => ({ ...current, [nodeId]: children }));
    });
  };

  const toggleSection = (sectionId: string) => {
    const expanded = treeState.expandedSectionIds.includes(sectionId);

    workbench.renderers.setSectionExpanded(treeViewId, sectionId, !expanded);
  };

  const openResource = (nodeId: string, resource: ResourceRef) => {
    workbench.renderers.setSelectedNode(treeViewId, nodeId);

    void workbench.resources.openResource(resource, { replaceActive: true }).catch(onOpenResourceError);
  };
  const openTarget = (nodeId: string, target: NavigationTarget) => {
    if (shouldSelectTreeNodeForNavigationTarget(target)) {
      workbench.renderers.setSelectedNode(treeViewId, nodeId);
    }

    void workbench.navigation.openTarget(target).catch(onOpenResourceError);
  };
  const navigateTreeNode = (nodeId: string, intent: { id?: string; payload?: unknown } | undefined) => {
    if (intent?.id === "target") {
      openTarget(nodeId, intent.payload as NavigationTarget);
      return;
    }

    if (intent?.id !== "resource") return;
    const resource = intent.payload;
    if (!resource || typeof resource !== "object") return;
    openResource(nodeId, resource as ResourceRef);
  };

  const footerSections =
    footer.length > 0
      ? [
          toTreeListSection(footerSection(footer), childrenByNodeId, {
            workbench,
            onCommandError: onOpenResourceError,
            onRequestParams: setParamsRequest,
          }),
        ]
      : [];
  const bodyActiveNodeId = resolveTreeListSelection({
    sections: body,
    childrenByNodeId,
    activeNodeId,
    activeResource,
    selectedNodeId: treeState.selectedNodeId,
  });
  const footerActiveNodeId = resolveTreeListSelection({
    sections: footerSections.length > 0 ? [footerSection(footer)] : [],
    childrenByNodeId,
    activeNodeId,
    activeResource,
    selectedNodeId: treeState.selectedNodeId,
  });

  return (
    <Flex as="section" direction="column" h="full" minH="0" minW="0" aria-label={treeRenderer.title}>
      <ScrollArea
        flex="1"
        mt="lg"
        minH="0"
        w="full"
        viewportRef={scrollRef}
        viewportProps={{
          display: "block",
          style: { overflowX: "hidden" },
        }}
        contentProps={{
          style: { minWidth: "100%", width: "100%", minHeight: "100%", display: "flex", flexDirection: "column" },
        }}
      >
        <Box w="full" minW="0" flex="1 0 auto" display="flex" flexDirection="column">
          <TreeViewBody
            loading={loading}
            moduleLoading={treeState.loading}
            sections={visibleSections}
            backgroundContextActions={backgroundContextActions}
            activeNodeId={bodyActiveNodeId}
            expandedNodeIds={treeState.expandedNodeIds}
            expandedSectionIds={treeState.expandedSectionIds}
            scrollRef={scrollRef}
            onToggleSection={toggleSection}
            onToggleNode={toggleNode}
            onNavigate={(event) => navigateTreeNode(event.nodeId, event.intent)}
          />
        </Box>
      </ScrollArea>
      {!loading && footerSections.length > 0 ? (
        <Flex bg={workbenchBackgrounds.sideBar} flexShrink={0}>
          <TreeList
            sections={footerSections}
            expandedNodeIds={treeState.expandedNodeIds}
            expandedSectionIds={treeState.expandedSectionIds}
            activeNodeId={footerActiveNodeId}
            rowVariant="compact"
            onToggleSection={toggleSection}
            onToggleNode={toggleNode}
            onNavigate={(event) => navigateTreeNode(event.nodeId, event.intent)}
          />
        </Flex>
      ) : null}
      <CommandParamsDialog
        request={paramsRequest?.request ?? null}
        renderParamField={renderParamField}
        onClose={() => setParamsRequest(null)}
        onRun={async ({ args }) => {
          await paramsRequest?.run(args);
        }}
      />
    </Flex>
  );
};
