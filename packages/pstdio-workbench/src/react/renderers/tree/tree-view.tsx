import { Box, Flex, Text } from "@chakra-ui/react";
import { type ResourceContextAction, ScrollArea, TreeList } from "@pstdio/ui";
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

interface TreeParamsDialogProps {
  request: TreeActionParamsRequest | null;
  renderParamField?: CommandParamFieldRenderer;
  onClose: () => void;
}

const TreeParamsDialog = (props: TreeParamsDialogProps) => {
  const { request, renderParamField, onClose } = props;
  return (
    <CommandParamsDialog
      request={request?.request ?? null}
      renderParamField={renderParamField}
      onClose={onClose}
      onRun={async ({ args }) => {
        await request?.run(args);
      }}
    />
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
  const treeState =
    useWorkbenchStore(workbench.renderers.treeStore, (state) => state.statesByTreeId[treeViewId]) ?? EMPTY_TREE_STATE;
  const activeResource = useWorkbenchStore(workbench.layout.store, (state) => resolveTreeActiveResource(state.layout));
  const [header, setHeader] = useState<TreeNode[]>([]);
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
      void loadTreeData(workbench.renderers, treeViewId, { resource, viewId }).then((data) => {
        if (cancelled) return;
        loadedTreeIdRef.current = treeViewId;
        if (!data) {
          setHeader([]);
          setBody([]);
          setFooter([]);
          setChildrenByNodeId({});
          setLoading(false);
          return;
        }
        setHeader(data.header);
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
  }, [resource, viewId, workbench, treeViewId]);

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

  const toggleNode = (nodeId: string) => {
    const node =
      findNodeInSections(body, nodeId, childrenByNodeId) ??
      findNodeInSections(
        [regionSection(HEADER_SECTION_ID, header), regionSection(FOOTER_SECTION_ID, footer)],
        nodeId,
        childrenByNodeId,
      );
    if (!node) return;

    const expanded = treeState.expandedNodeIds.includes(nodeId);

    workbench.renderers.setNodeExpanded(treeViewId, nodeId, !expanded);

    if (expanded || childrenByNodeId[nodeId]) return;
    if (node.children) return;

    void workbench.renderers.getChildren(treeViewId, node, { resource, viewId }).then((children) => {
      setChildrenByNodeId((current) => ({ ...current, [nodeId]: children }));
    });
  };

  const toggleSection = (sectionId: string) => {
    const expanded = treeState.expandedSectionIds.includes(sectionId);

    workbench.renderers.setSectionExpanded(treeViewId, sectionId, !expanded);
  };

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
