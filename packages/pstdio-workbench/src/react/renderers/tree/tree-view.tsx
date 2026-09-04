import { Box, Flex, Text } from "@chakra-ui/react";
import { type ResourceContextAction, ScrollArea, TreeList, TreeListDragProvider } from "@pstdio/ui";
import { type Dispatch, type SetStateAction, useEffect, useRef, useState } from "react";
import type {
  NavigationTarget,
  ResourceRef,
  TreeNode,
  TreeRendererState,
  TreeViewSection,
  WorkbenchCore,
} from "../../../core";
import { getAnchorResource, getWorkbenchRenderers } from "../../../core";
import type { CommandParamFieldRenderer } from "../../command-palette/command-params-dialog";
import { WorkbenchIcon } from "../../shared/icon";
import { useWorkbenchStore } from "../../shared/use-workbench-store";
import { workbenchBackgrounds } from "../../theme/workbench-theme-background";
import type { TreeActionParamsRequest } from "./tree-actions";
import {
  filterTreeListSelection,
  findNodeInSections,
  resolveTreeListSelection,
  toTreeListSection,
} from "./tree-list-adapter";
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
      getWorkbenchRenderers(context.workbench).setSelectedNode(context.treeViewId, nodeId);
    }
    void context.workbench.navigation.openTarget(target).catch(context.onOpenResourceError);
    return;
  }
};

interface ToggleTreeNodeContext {
  workbench: WorkbenchCore;
  treeViewId: string;
  resource?: ResourceRef;
  viewId?: string;
  body: TreeViewSection[];
  header: TreeViewSection[];
  footer: TreeViewSection[];
  childrenByNodeId: Record<string, TreeNode[]>;
  expandedNodeIds: string[];
  setChildrenByNodeId: Dispatch<SetStateAction<Record<string, TreeNode[]>>>;
}

const createToggleTreeNode = (context: ToggleTreeNodeContext) => (nodeId: string) => {
  const node =
    findNodeInSections(context.body, nodeId, context.childrenByNodeId) ??
    findNodeInSections([...context.header, ...context.footer], nodeId, context.childrenByNodeId);
  if (!node) return;

  const expanded = context.expandedNodeIds.includes(nodeId);
  getWorkbenchRenderers(context.workbench).setNodeExpanded(context.treeViewId, nodeId, !expanded);
  if (expanded || context.childrenByNodeId[nodeId] || node.children) return;

  void getWorkbenchRenderers(context.workbench)
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
  const treeRenderer = getWorkbenchRenderers(workbench).getTreeRenderer(treeViewId);
  const [filter, setFilter] = useState("");
  const treeState =
    useWorkbenchStore(getWorkbenchRenderers(workbench).treeStore, (state) => state.statesByTreeId[treeViewId]) ??
    EMPTY_TREE_STATE;
  const projectId = useWorkbenchStore(workbench.pages.store, (state) => state.projectId);
  const activePage = useWorkbenchStore(workbench.pages.store, (state) =>
    state.location?.resource ? undefined : state.location?.page,
  );
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
  const rawHeaderSections = header.map((section) => toTreeListSection(section, childrenByNodeId, adapterContext));
  const rawFooterSections = footer.map((section) => toTreeListSection(section, childrenByNodeId, adapterContext));
  const {
    visibleHeaderSections,
    visibleSections,
    visibleFooterSections,
    backgroundContextActions,
    customizationRevision,
    onReorderSections,
    onReorderNodes,
    onMoveSection,
  } = useTreeViewCustomization(
    `${treeViewId}:${projectId ?? "global"}`,
    {
      headerSections: rawHeaderSections,
      sections: rawSections,
      footerSections: rawFooterSections,
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

    getWorkbenchRenderers(workbench).setSectionExpanded(treeViewId, sectionId, !expanded);
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

  const activeNodeSelection = resolveTreeListSelection({
    sections: [...header, ...body, ...footer],
    childrenByNodeId,
    activeNodeId,
    activePage,
    activeResource,
    selectedNodeId: treeState.selectedNodeId,
  });
  const headerActiveNodeId = filterTreeListSelection(header, childrenByNodeId, activeNodeSelection);
  const bodyActiveNodeId = filterTreeListSelection(body, childrenByNodeId, activeNodeSelection);
  const footerActiveNodeId = filterTreeListSelection(footer, childrenByNodeId, activeNodeSelection);

  return (
    <TreeListDragProvider
      sections={[...visibleHeaderSections, ...visibleSections, ...visibleFooterSections]}
      canMove={treeRenderer.canMove}
      onReorderSections={onMoveSection}
      onReorderNodes={onReorderNodes}
    >
      <Flex as="section" direction="column" h="full" minH="0" minW="0" aria-label={treeRenderer.title}>
        {!loading && visibleHeaderSections.length > 0 ? (
          <Flex bg={workbenchBackgrounds.sidenav} flexShrink={0}>
            <TreeList
              sections={visibleHeaderSections}
              draggable={Boolean(onSidenavContextActionsChange)}
              expandedNodeIds={treeState.expandedNodeIds}
              expandedSectionIds={treeState.expandedSectionIds}
              activeNodeId={headerActiveNodeId}
              rowVariant="compact"
              sectionGap="md"
              nodeGap="1px"
              onToggleSection={toggleSection}
              onToggleNode={toggleNode}
              onReorderSections={(nextSectionIds) => onReorderSections("header", nextSectionIds)}
              onReorderNodes={onReorderNodes}
              canMove={treeRenderer.canMove}
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
              onReorderSections={(nextSectionIds) => onReorderSections("content", nextSectionIds)}
              onReorderNodes={onReorderNodes}
              canMove={treeRenderer.canMove}
              onMoveNode={moveNode}
              onNavigate={(event) => navigateTreeNode(navigationContext, event.nodeId, event.intent)}
            />
          </Box>
        </ScrollArea>
        {!loading && visibleFooterSections.length > 0 ? (
          <Flex bg={workbenchBackgrounds.sidenav} flexShrink={0}>
            <TreeList
              sections={visibleFooterSections}
              draggable={Boolean(onSidenavContextActionsChange)}
              expandedNodeIds={treeState.expandedNodeIds}
              expandedSectionIds={treeState.expandedSectionIds}
              activeNodeId={footerActiveNodeId}
              rowVariant="compact"
              sectionGap="md"
              nodeGap="1px"
              onToggleSection={toggleSection}
              onToggleNode={toggleNode}
              onReorderSections={(nextSectionIds) => onReorderSections("footer", nextSectionIds)}
              onReorderNodes={onReorderNodes}
              canMove={treeRenderer.canMove}
              onNavigate={(event) => navigateTreeNode(navigationContext, event.nodeId, event.intent)}
            />
          </Flex>
        ) : null}
        <TreeParamsDialog
          request={paramsRequest}
          renderParamField={renderParamField}
          workbench={workbench}
          onClose={() => setParamsRequest(null)}
        />
      </Flex>
    </TreeListDragProvider>
  );
};
