import { Box, Flex, Text } from "@chakra-ui/react";
import { type ResourceContextAction, ScrollArea, TreeList } from "@pstdio/ui";
import { type Dispatch, type SetStateAction, useEffect, useRef, useState } from "react";
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
import { WorkbenchIcon } from "../../shared/icon";
import { useWorkbenchStore } from "../../shared/use-workbench-store";
import { workbenchBackgrounds } from "../../theme/workbench-theme-background";
import type { TreeActionParamsRequest } from "./tree-actions";
import { findNodeInSections, resolveTreeListSelection, toTreeListSection } from "./tree-list-adapter";
import { TreeParamsDialog } from "./tree-params-dialog";
import { TreeViewBody } from "./tree-view-body";
import { createMoveTreeNode } from "./tree-view-move";
import { shouldSelectTreeNodeForNavigationTarget } from "./tree-view-navigation";
import { TreeViewSearch } from "./tree-view-search";
import { useTreeData } from "./use-tree-data";
import { useTreeViewCustomization } from "./use-tree-view-customization";

interface WorkbenchTreeViewProps {
  workbench: WorkbenchCore;
  treeViewId: string;
  activeNodeId?: string | null;
  resource?: ResourceRef;
  viewId?: string;
  renderParamField?: CommandParamFieldRenderer;
  onOpenResourceError?: (error: unknown) => void;
  onSidenavContextActionsChange?: (actions: ResourceContextAction[]) => void;
}

const EMPTY_TREE_STATE: TreeRendererState = { expandedNodeIds: [], expandedSectionIds: [] };

const HEADER_SECTION_ID = "__header__";
const FOOTER_SECTION_ID = "__footer__";

// Header and footer rows are flat node lists; wrap them in a single unlabeled section so they
// reuse the same TreeList adapter/rendering as the body (and mirror each other exactly).
const regionSection = (id: string, nodes: TreeNode[]): TreeViewSection => ({ id, nodes, canReorder: false });

type WorkbenchLayoutState = ReturnType<WorkbenchCore["layout"]["getLayout"]>;

const resolveActivePlacement = (
  widgets: WorkbenchLayoutState["regions"]["overlay"]["widgets"],
  activeWidgetId: string | undefined,
) => widgets.find((entry) => entry.widgetId === activeWidgetId) ?? widgets[0];

const resolveTreeActiveResource = (layout: WorkbenchLayoutState) =>
  resolveActivePlacement(layout.regions.overlay.widgets, layout.regions.overlay.activeWidgetId)?.resource ??
  getAnchorResource(layout, "primary");

const useSidenavContextActions = (
  actions: ResourceContextAction[],
  revision: string,
  onChange: ((actions: ResourceContextAction[]) => void) | undefined,
) => {
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  useEffect(() => {
    void revision;
    onChange?.(actionsRef.current);
  }, [revision, onChange]);

  useEffect(
    () => () => {
      onChange?.([]);
    },
    [onChange],
  );
};

interface TreeNavigationContext {
  workbench: WorkbenchCore;
  treeViewId: string;
  onOpenResourceError?: (error: unknown) => void;
}

const navigateTreeNode = (
  context: TreeNavigationContext,
  nodeId: string,
  intent: { id?: string; payload?: unknown } | undefined,
) => {
  if (intent?.id === "target") {
    const target = intent.payload as NavigationTarget;
    if (shouldSelectTreeNodeForNavigationTarget(target)) {
      context.workbench.renderers.setSelectedNode(context.treeViewId, nodeId);
    }
    void context.workbench.navigation.openTarget(target).catch(context.onOpenResourceError);
    return;
  }

  if (intent?.id !== "resource" || !intent.payload || typeof intent.payload !== "object") return;
  context.workbench.renderers.setSelectedNode(context.treeViewId, nodeId);
  void context.workbench.resources
    .openResource(intent.payload as ResourceRef, { replaceActive: true })
    .catch(context.onOpenResourceError);
};

interface ToggleTreeNodeContext {
  workbench: WorkbenchCore;
  treeViewId: string;
  resource?: ResourceRef;
  viewId?: string;
  body: TreeViewSection[];
  header: TreeNode[];
  footer: TreeNode[];
  childrenByNodeId: Record<string, TreeNode[]>;
  expandedNodeIds: string[];
  setChildrenByNodeId: Dispatch<SetStateAction<Record<string, TreeNode[]>>>;
}

const createToggleTreeNode = (context: ToggleTreeNodeContext) => (nodeId: string) => {
  const node =
    findNodeInSections(context.body, nodeId, context.childrenByNodeId) ??
    findNodeInSections(
      [regionSection(HEADER_SECTION_ID, context.header), regionSection(FOOTER_SECTION_ID, context.footer)],
      nodeId,
      context.childrenByNodeId,
    );
  if (!node) return;

  const expanded = context.expandedNodeIds.includes(nodeId);
  context.workbench.renderers.setNodeExpanded(context.treeViewId, nodeId, !expanded);
  if (expanded || context.childrenByNodeId[nodeId] || node.children) return;

  void context.workbench.renderers
    .getChildren(context.treeViewId, node, { resource: context.resource, viewId: context.viewId })
    .then((children) => {
      context.setChildrenByNodeId((current) => ({ ...current, [nodeId]: children }));
    });
};

export const WorkbenchTreeView = (props: WorkbenchTreeViewProps) => {
  const {
    workbench,
    treeViewId,
    activeNodeId,
    resource,
    viewId,
    renderParamField,
    onOpenResourceError,
    onSidenavContextActionsChange,
  } = props;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const treeRenderer = workbench.renderers.getTreeRenderer(treeViewId);
  const [filter, setFilter] = useState("");
  const treeState =
    useWorkbenchStore(workbench.renderers.treeStore, (state) => state.statesByTreeId[treeViewId]) ?? EMPTY_TREE_STATE;
  const activeResource = useWorkbenchStore(workbench.layout.store, (state) => resolveTreeActiveResource(state.layout));
  const { body, childrenByNodeId, error, footer, header, loading, setChildrenByNodeId } = useTreeData(
    workbench,
    treeViewId,
    resource,
    viewId,
    treeRenderer?.searchable ? filter.trim() || undefined : undefined,
  );
  const [paramsRequest, setParamsRequest] = useState<TreeActionParamsRequest | null>(null);

  const adapterContext = {
    workbench,
    onCommandError: onOpenResourceError,
    onRequestParams: setParamsRequest,
    suppressContextMenus: Boolean(onSidenavContextActionsChange),
  };
  const rawSections = body.map((section) => toTreeListSection(section, childrenByNodeId, adapterContext));
  const rawHeaderSection =
    header.length > 0
      ? toTreeListSection(regionSection(HEADER_SECTION_ID, header), childrenByNodeId, adapterContext)
      : undefined;
  const rawFooterSection =
    footer.length > 0
      ? toTreeListSection(regionSection(FOOTER_SECTION_ID, footer), childrenByNodeId, adapterContext)
      : undefined;
  const {
    visibleHeaderNodes,
    visibleSections,
    visibleFooterNodes,
    backgroundContextActions,
    customizationRevision,
    onReorderHeaderNodes,
    onReorderSections,
    onReorderNodes,
    onReorderFooterNodes,
  } = useTreeViewCustomization(
    treeViewId,
    {
      headerNodes: rawHeaderSection?.nodes ?? [],
      sections: rawSections,
      footerNodes: rawFooterSection?.nodes ?? [],
    },
    {
      visibleIcon: <WorkbenchIcon name="eye" size={14} />,
      hiddenIcon: <WorkbenchIcon name="eye-off" size={14} />,
      resetIcon: <WorkbenchIcon name="rotate-ccw" size={14} />,
    },
    { suppressNodeContextMenus: Boolean(onSidenavContextActionsChange) },
  );
  useSidenavContextActions(backgroundContextActions, customizationRevision, onSidenavContextActionsChange);
  if (!treeRenderer) {
    return (
      <Text textStyle="paragraph/S/regular" color="fg.muted" p="sm">
        Tree renderer is no longer registered.
      </Text>
    );
  }

  const toggleNode = createToggleTreeNode({
    workbench,
    treeViewId,
    resource,
    viewId,
    body,
    header,
    footer,
    childrenByNodeId,
    expandedNodeIds: treeState.expandedNodeIds,
    setChildrenByNodeId,
  });

  const toggleSection = (sectionId: string) => {
    const expanded = treeState.expandedSectionIds.includes(sectionId);

    workbench.renderers.setSectionExpanded(treeViewId, sectionId, !expanded);
  };
  const moveNode = createMoveTreeNode({
    workbench,
    renderer: treeRenderer,
    resource,
    viewId,
    sections: body,
    childrenByNodeId,
    onError: onOpenResourceError,
  });

  const navigationContext = { workbench, treeViewId, onOpenResourceError };

  const headerSections =
    rawHeaderSection && visibleHeaderNodes.length > 0 ? [{ ...rawHeaderSection, nodes: visibleHeaderNodes }] : [];
  const footerSections =
    rawFooterSection && visibleFooterNodes.length > 0 ? [{ ...rawFooterSection, nodes: visibleFooterNodes }] : [];
  const bodyActiveNodeId = resolveTreeListSelection({
    sections: body,
    childrenByNodeId,
    activeNodeId,
    activeResource,
    selectedNodeId: treeState.selectedNodeId,
  });
  const regionActiveNodeId = resolveTreeListSelection({
    sections: [regionSection(HEADER_SECTION_ID, header), regionSection(FOOTER_SECTION_ID, footer)],
    childrenByNodeId,
    activeNodeId,
    activeResource,
    selectedNodeId: treeState.selectedNodeId,
  });

  return (
    <Flex as="section" direction="column" h="full" minH="0" minW="0" aria-label={treeRenderer.title}>
      {!loading && headerSections.length > 0 ? (
        <Flex bg={workbenchBackgrounds.sidenav} flexShrink={0}>
          <TreeList
            sections={headerSections}
            draggable={Boolean(onSidenavContextActionsChange)}
            expandedNodeIds={treeState.expandedNodeIds}
            expandedSectionIds={treeState.expandedSectionIds}
            activeNodeId={regionActiveNodeId}
            rowVariant="compact"
            nodeGap="1px"
            onToggleSection={toggleSection}
            onToggleNode={toggleNode}
            onReorderNodes={(_sectionId, nextNodeIds) => onReorderHeaderNodes(nextNodeIds)}
            onNavigate={(event) => navigateTreeNode(navigationContext, event.nodeId, event.intent)}
          />
        </Flex>
      ) : null}
      <TreeViewSearch
        visible={!loading && Boolean(treeRenderer.searchable)}
        placeholder={treeRenderer.searchPlaceholder}
        value={filter}
        onChange={setFilter}
      />
      <ScrollArea
        flex="1"
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
            error={error}
            loading={loading}
            moduleLoading={treeState.loading}
            sections={visibleSections}
            backgroundContextActions={onSidenavContextActionsChange ? undefined : backgroundContextActions}
            draggable={Boolean(onSidenavContextActionsChange)}
            customizationAvailable={Boolean(onSidenavContextActionsChange)}
            activeNodeId={bodyActiveNodeId}
            expandedNodeIds={treeState.expandedNodeIds}
            expandedSectionIds={treeState.expandedSectionIds}
            scrollRef={scrollRef}
            onToggleSection={toggleSection}
            onToggleNode={toggleNode}
            onReorderSections={onReorderSections}
            onReorderNodes={onReorderNodes}
            onMoveNode={moveNode}
            onNavigate={(event) => navigateTreeNode(navigationContext, event.nodeId, event.intent)}
          />
        </Box>
      </ScrollArea>
      {!loading && footerSections.length > 0 ? (
        <Flex bg={workbenchBackgrounds.sidenav} flexShrink={0}>
          <TreeList
            sections={footerSections}
            draggable={Boolean(onSidenavContextActionsChange)}
            expandedNodeIds={treeState.expandedNodeIds}
            expandedSectionIds={treeState.expandedSectionIds}
            activeNodeId={regionActiveNodeId}
            rowVariant="compact"
            nodeGap="1px"
            onToggleSection={toggleSection}
            onToggleNode={toggleNode}
            onReorderNodes={(_sectionId, nextNodeIds) => onReorderFooterNodes(nextNodeIds)}
            onNavigate={(event) => navigateTreeNode(navigationContext, event.nodeId, event.intent)}
          />
        </Flex>
      ) : null}
      <TreeParamsDialog
        request={paramsRequest}
        renderParamField={renderParamField}
        onClose={() => setParamsRequest(null)}
      />
    </Flex>
  );
};
