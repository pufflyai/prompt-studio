import { createTreeNavigator } from "./tree-navigator";

export { createTreeNavigator } from "./tree-navigator";

import { Box, Flex, Text } from "@chakra-ui/react";
import { type ResourceContextAction, ScrollArea, TreeList, TreeListDragProvider } from "@pstdio/ui";
import { type ReactNode, useEffect, useRef } from "react";
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

const treeCustomizationOptions = (sections: TreeViewSection[], isSidenav: boolean, groupScope?: TreeGroupScope) => ({
  suppressNodeContextMenus: isSidenav,
  pinnedOnlyNodeIds: pinnedOnlyNodeIds(sections),
  allowGroups: isSidenav,
  groupScope,
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
  const isSidenav = Boolean(onSidenavContextActionsChange);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const treeRenderer = getWorkbenchRenderers(workbench).getTreeRenderer(treeViewId);
  const {
    projectId,
    activeLocation,
    activeResource,
    hostRegion,
    stateScope,
    presentationKey,
    presentation,
    treeState,
  } = useTreeViewState(workbench, treeViewId, resource, props.placement, isSidenav);
  const filter = presentation.filter;
  const { body, childrenByNodeId, moveNode, error, footer, groupScope, header, loadChildren, loading, retry } =
    useTreeData(
      workbench,
      treeViewId,
      resource,
      viewId,
      treeRenderer?.searchable ? filter.trim() || undefined : undefined,
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
    {
      visibleIcon: <WorkbenchIcon name="eye" size={14} />,
      hiddenIcon: <WorkbenchIcon name="eye-off" size={14} />,
      resetIcon: <WorkbenchIcon name="rotate-ccw" size={14} />,
    },
    treeCustomizationOptions([...header, ...body, ...footer], isSidenav, groupScope),
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
      selectedNodeId: treeState.selectedNodeId,
    },
    stateScope,
  );

  useTreeScrollRestoration(scrollRef, presentationKey, presentation.scrollTop, loading);

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

  const navigate = createTreeNavigator({ workbench, treeViewId, stateScope, hostRegion, onOpenResourceError });
  const pinnedTreeProps = {
    draggable: isSidenav,
    expandedNodeIds: actionInput.expandedNodeIds,
    expandedSectionIds: treeState.expandedSectionIds,
    activeNodeId: activeNodeSelection,
    rowVariant: "compact" as const,
    nodeGap: "1px",
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
        direction="column"
        h="full"
        minH="0"
        minW="0"
        aria-label={treeRenderer.title}
        aria-busy={loading}
      >
        {visibleHeaderSections.length > 0 ? (
          <Flex bg={workbenchBackgrounds.sidenav} flexShrink={0}>
            <TreeList
              {...pinnedTreeProps}
              sections={visibleHeaderSections}
              sectionGap="1px"
              onReorderSections={(nextSectionIds) => onReorderSections("header", nextSectionIds)}
            />
          </Flex>
        ) : null}
        {isSidenav ? <TreeModeReturn workbench={workbench} /> : null}
        <TreeViewSearch
          visible={Boolean(treeRenderer.searchable)}
          placeholder={treeRenderer.searchPlaceholder}
          value={filter}
          onChange={(filter) => presentation.update({ filter })}
        />
        {error && !isSidenav ? <RendererReadNotice error={error} retry={retry} /> : null}
        <ScrollArea
          flex="1"
          minH="0"
          w="full"
          viewportRef={scrollRef}
          viewportProps={{
            display: "block",
            style: { overflowX: "hidden" },
            onScroll: (event) => {
              if (!loading) presentation.update({ scrollTop: event.currentTarget.scrollTop });
            },
          }}
          contentProps={{
            style: { minWidth: "100%", width: "100%", minHeight: "100%", display: "flex", flexDirection: "column" },
          }}
        >
          <Box w="full" minW="0" flex="1 0 auto" display="flex" flexDirection="column">
            <TreeViewBody
              loadingContent={props.loadingContent}
              error={error}
              loading={loading}
              moduleLoading={treeState.loading}
              sections={visibleSections}
              backgroundContextActions={
                isSidenav ? undefined : createTreeBackgroundActions(visibleSections, backgroundContextActions)
              }
              draggable={isSidenav}
              customizationAvailable={isSidenav}
              activeNodeId={activeNodeSelection}
              expandedNodeIds={actionInput.expandedNodeIds}
              expandedSectionIds={treeState.expandedSectionIds}
              scrollRef={scrollRef}
              onToggleSection={toggleSection}
              onToggleNode={toggleNode}
              onReorderSections={(nextSectionIds) => onReorderSections("content", nextSectionIds)}
              onReorderNodes={onReorderNodes}
              canMove={treeRenderer.canMove}
              onMoveNode={moveNode}
              onNavigate={navigate}
            />
          </Box>
        </ScrollArea>
        {visibleFooterSections.length > 0 ? (
          <Flex bg={workbenchBackgrounds.sidenav} flexShrink={0}>
            <TreeList
              {...pinnedTreeProps}
              sections={visibleFooterSections}
              sectionGap="md"
              onReorderSections={(nextSectionIds) => onReorderSections("footer", nextSectionIds)}
            />
          </Flex>
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

const MissingTreeRenderer = () => (
  <Text textStyle="paragraph/S/regular" color="fg.muted" p="sm">
    Tree renderer is no longer registered.
  </Text>
);
