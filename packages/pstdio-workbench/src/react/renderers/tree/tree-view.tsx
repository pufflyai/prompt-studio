import { createTreeNavigator } from "./tree-navigator";

export { createTreeNavigator } from "./tree-navigator";

import { Box, Flex, Text } from "@chakra-ui/react";
import { type ResourceContextAction, ScrollArea, TreeList, TreeListDragProvider } from "@pstdio/ui";
import { type ComponentProps, type ReactNode, useEffect, useRef, useState } from "react";
import type { ResourceRef, TreeViewSection, WorkbenchCore, WorkbenchPanelInstance } from "../../../core";
import { getWorkbenchRenderers } from "../../../core";
import type { TreeGroupScope } from "../../../core/registries/renderers/tree-renderer-types";
import type { CommandParamFieldRenderer } from "../../command-palette/command-params-dialog";
import { WorkbenchIcon } from "../../shared/icon";
import type { SidenavContextActionsChange } from "../../shared/sidenav-context-actions";
import { useWorkbenchStore } from "../../shared/use-workbench-store";
import { workbenchBackgrounds } from "../../theme/workbench-theme-background";
import { RendererReadNotice } from "../renderer-read-notice";
import { createTreeBackgroundActions } from "./tree-background-actions";
import { useTreeActionInput } from "./tree-inline-input";
import { toTreeListSection } from "./tree-list-adapter";
import { TreeModeReturn } from "./tree-mode-return";
import { TreeParamsDialog } from "./tree-params-dialog";
import { pinnedOnlyNodeIds } from "./tree-pinned-only";
import { useTreeScrollRestoration, useTreeViewState } from "./tree-presentation-state";
import { createTreeTabDropHandler } from "./tree-tab-drop";
import { TreeViewBody } from "./tree-view-body";
import { createToggleTreeNode, createToggleTreeSection } from "./tree-view-navigation";
import { TreeViewSearch } from "./tree-view-search";
import { TreeVisibilityDialog } from "./tree-visibility-dialog";
import { useTreeWorkbenchContext } from "./tree-workbench-context";
import { useTreeData } from "./use-tree-data";
import { useTreeSelection } from "./use-tree-selection";
import { useTreeViewCustomization } from "./use-tree-view-customization";

interface WorkbenchTreeViewProps {
  readOwnerKey?: string;
  loadingContent?: ReactNode;
  placement?: WorkbenchPanelInstance;
  workbench: WorkbenchCore;
  treeViewId: string;
  activeNodeId?: string | null;
  resource?: ResourceRef;
  viewId?: string;
  renderParamField?: CommandParamFieldRenderer;
  onOpenResourceError?: (error: unknown) => void;
  onSidenavContextActionsChange?: SidenavContextActionsChange;
}

const treeVisibilityIcons = {
  visibleIcon: <WorkbenchIcon name="eye" size={14} />,
  hiddenIcon: <WorkbenchIcon name="eye-off" size={14} />,
};

const treeCustomizationOptions = (
  sections: TreeViewSection[],
  isSidenav: boolean,
  groupScope: TreeGroupScope | undefined,
  openVisibility: () => void,
) => ({
  suppressNodeContextMenus: isSidenav,
  pinnedOnlyNodeIds: pinnedOnlyNodeIds(sections),
  allowGroups: isSidenav,
  groupScope,
  openVisibility,
});

const useSidenavContextActions = (
  ownerId: string,
  actions: ResourceContextAction[],
  revision: string,
  onChange: SidenavContextActionsChange | undefined,
) => {
  const actionsRef = useRef(actions);
  // Updated after render, before the effect below reads it: React Compiler skips hooks that write
  // refs while rendering.
  useEffect(() => {
    actionsRef.current = actions;
  }, [actions]);

  useEffect(() => {
    void revision;
    onChange?.({ ownerId, actions: actionsRef.current });
  }, [ownerId, revision, onChange]);

  useEffect(
    () => () => {
      onChange?.({ ownerId, actions: [] });
    },
    [ownerId, onChange],
  );
};

export const WorkbenchTreeView = (props: WorkbenchTreeViewProps) => {
  const { workbench, treeViewId, activeNodeId, resource, viewId } = props;
  const { renderParamField, onOpenResourceError, onSidenavContextActionsChange } = props;
  const isSidenav = Boolean(onSidenavContextActionsChange);
  const treeRef = useRef<HTMLDivElement>(null);
  const [visibilityOpen, setVisibilityOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const treeRenderer = getWorkbenchRenderers(workbench).getTreeRenderer(treeViewId);
  const {
    projectId,
    activeLocation,
    activeResource,
    activeSlot,
    hostRegion,
    owner,
    stateScope,
    presentationKey,
    presentation,
    treeState,
  } = useTreeViewState(workbench, treeViewId, resource, props.placement, isSidenav);
  const query = treeRenderer?.searchable ? presentation.filter.trim() || undefined : undefined;
  const { body, childrenByNodeId, moveNode, error, footer, groupScope, header, loadChildren, loading, retry } =
    useTreeData(
      workbench,
      treeViewId,
      resource,
      viewId,
      query,
      props.readOwnerKey,
      onOpenResourceError,
      props.placement,
      stateScope,
    );
  const actionInput = useTreeActionInput(`${treeViewId}:${projectId}:${resource?.id}`, treeState.expandedNodeIds);
  const shortcutHints = useWorkbenchStore(workbench.keyboard.store, (state) => state.active || state.preview);
  const adapterContext = {
    workbench,
    resource,
    shortcutHints,
    onCommandError: onOpenResourceError,
    onRequestParams: actionInput.setRequest,
  };
  const adaptSections = (sections: TreeViewSection[]) =>
    actionInput.sections(sections.map((section) => toTreeListSection(section, childrenByNodeId, adapterContext)));
  const {
    visibleHeaderSections,
    visibleSections,
    visibleFooterSections,
    backgroundContextActions,
    customizationRevision,
    visibilityItems,
    resetCustomization,
    onReorderSections,
    onReorderNodes,
    onMoveSection,
  } = useTreeViewCustomization(
    `${treeViewId}:${projectId ?? "global"}`,
    {
      headerSections: adaptSections(header),
      sections: adaptSections(body),
      footerSections: adaptSections(footer),
    },
    treeVisibilityIcons,
    treeCustomizationOptions([...header, ...body, ...footer], isSidenav, groupScope, () => setVisibilityOpen(true)),
  );
  useSidenavContextActions(
    props.placement?.instanceId ?? treeViewId,
    backgroundContextActions,
    customizationRevision,
    onSidenavContextActionsChange,
  );
  const activeNodeSelection = useTreeSelection(
    workbench,
    treeViewId,
    {
      sections: [...header, ...body, ...footer],
      childrenByNodeId,
      activeNodeId,
      activeLocation,
      activeResource,
      activeSlot,
      selectedNodeId: treeState.selectedNodeId,
    },
    stateScope,
  );

  useTreeWorkbenchContext(workbench, props.placement?.instanceId, projectId, {
    selectedId: treeState.selectedNodeId,
    sections: [...header, ...body, ...footer],
    childrenByNodeId,
  });

  useTreeScrollRestoration(scrollRef, presentationKey, query, presentation.scrollTop, loading);

  if (!treeRenderer) return <MissingTreeRenderer />;

  const toggleNode = createToggleTreeNode({
    workbench,
    treeViewId,
    stateScope,
    body,
    header,
    footer,
    childrenByNodeId,
    expandedNodeIds: treeState.expandedNodeIds,
    loadChildren,
  });

  const toggleSection = createToggleTreeSection(workbench, treeViewId, treeState.expandedSectionIds, stateScope);

  const navigate = createTreeNavigator({
    workbench,
    treeViewId,
    stateScope,
    isSidenav,
    hostRegion,
    owner,
    onOpenResourceError,
  });
  const treeControls = {
    draggable: isSidenav,
    expandedNodeIds: actionInput.expandedNodeIds,
    expandedSectionIds: treeState.expandedSectionIds,
    activeNodeId: activeNodeSelection,
    onToggleSection: toggleSection,
    onToggleNode: toggleNode,
    onReorderNodes,
    canMove: treeRenderer.canMove,
    onNavigate: navigate,
  };

  return (
    <TreeListDragProvider
      onDropOutside={isSidenav ? createTreeTabDropHandler(workbench) : undefined}
      sections={[...visibleHeaderSections, ...visibleSections, ...visibleFooterSections]}
      canMove={treeRenderer.canMove}
      onReorderSections={onMoveSection}
      onReorderNodes={onReorderNodes}
    >
      <Flex
        as="section"
        ref={treeRef}
        tabIndex={-1}
        direction="column"
        h="full"
        minH="0"
        minW="0"
        aria-label={treeRenderer.title}
        aria-busy={loading}
      >
        <PinnedTree
          slot="header"
          tree={{ ...treeControls, sections: visibleHeaderSections }}
          onReorderSections={onReorderSections}
        />
        {isSidenav ? <TreeModeReturn workbench={workbench} /> : null}
        <TreeViewSearch
          visible={Boolean(treeRenderer.searchable)}
          placeholder={treeRenderer.searchPlaceholder}
          value={presentation.filter}
          onChange={presentation.setFilter}
        />
        {error && !isSidenav ? <RendererReadNotice error={error} retry={retry} /> : null}
        <TreeViewport
          scrollRef={scrollRef}
          onScroll={(scrollTop) => {
            if (!loading) presentation.update({ scrollTop });
          }}
        >
          <TreeViewBody
            {...treeControls}
            loadingContent={props.loadingContent}
            error={error}
            loading={loading}
            moduleLoading={treeState.loading}
            sections={visibleSections}
            backgroundContextActions={
              isSidenav ? undefined : createTreeBackgroundActions(visibleSections, backgroundContextActions)
            }
            customizationAvailable={isSidenav}
            scrollRef={scrollRef}
            onReorderSections={(nextSectionIds) => onReorderSections("content", nextSectionIds)}
            onMoveNode={moveNode}
          />
        </TreeViewport>
        <PinnedTree
          slot="footer"
          tree={{ ...treeControls, sections: visibleFooterSections }}
          onReorderSections={onReorderSections}
        />
        {visibilityOpen ? (
          <TreeVisibilityDialog
            items={visibilityItems}
            onReset={resetCustomization}
            onClose={() => setVisibilityOpen(false)}
            returnFocus={() => treeRef.current}
          />
        ) : null}
        <TreeParamsDialog
          request={actionInput.request}
          sections={[...visibleHeaderSections, ...visibleSections, ...visibleFooterSections]}
          expansion={{ ...treeState, expandedNodeIds: actionInput.expandedNodeIds }}
          renderParamField={renderParamField}
          workbench={workbench}
          onClose={actionInput.close}
        />
      </Flex>
    </TreeListDragProvider>
  );
};

const PinnedTree = (props: {
  slot: "header" | "footer";
  tree: ComponentProps<typeof TreeList>;
  onReorderSections(slot: "header" | "footer", ids: string[]): void;
}) => {
  const { slot, tree, onReorderSections } = props;
  if (!tree.sections.length) return null;
  return (
    <Flex bg={workbenchBackgrounds.sidenav} flexShrink={0}>
      <TreeList
        {...tree}
        rowVariant="compact"
        nodeGap="1px"
        sectionGap={slot === "header" ? "1px" : "md"}
        onReorderSections={(ids) => onReorderSections(slot, ids)}
      />
    </Flex>
  );
};

const TreeViewport = ({
  scrollRef,
  onScroll,
  children,
}: {
  scrollRef: import("react").RefObject<HTMLDivElement | null>;
  onScroll(scrollTop: number): void;
  children: ReactNode;
}) => (
  <ScrollArea
    flex="1"
    minH="0"
    w="full"
    viewportRef={scrollRef}
    viewportProps={{
      display: "block",
      maxH: "var(--workbench-menu-max-height, none)",
      style: { overflowX: "hidden" },
      onScroll: (event) => onScroll(event.currentTarget.scrollTop),
    }}
    contentProps={{
      style: { minWidth: "100%", width: "100%", minHeight: "100%", display: "flex", flexDirection: "column" },
    }}
  >
    <Box w="full" minW="0" flex="1 0 auto" display="flex" flexDirection="column">
      {children}
    </Box>
  </ScrollArea>
);

const MissingTreeRenderer = () => (
  <Text textStyle="paragraph/S/regular" color="fg.muted" p="sm">
    Tree renderer is no longer registered.
  </Text>
);
