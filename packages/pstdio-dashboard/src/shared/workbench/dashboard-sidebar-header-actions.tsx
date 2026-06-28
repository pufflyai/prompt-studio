import { Box, type BoxProps } from "@chakra-ui/react";
import {
  buildTreeVisibilityMenuActions,
  filterVisibleNodes,
  resolveVisibility,
  TreeList,
  type TreeListActionMenuItem,
  type TreeListNavigateEvent,
  type TreeListNode,
  type TreeListSection,
  useTreeListVisibilityStore,
} from "@pstdio/ui";
import { getAnchorResource, type NavigationTarget, type ResourceRef, type TreeNode } from "pstdio-workbench/core";
import { useWorkbenchStore, WorkbenchIcon, type WorkbenchWidgetRenderInput } from "pstdio-workbench/react";
import type { ReactNode } from "react";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { getSidebarContributionHeaderNodes } from "./contributions/sidebar-tree-contributions";

const HEADER_SECTION_ID = "dashboard-sidebar-header";

const icon = (name: string, size = 14) => <WorkbenchIcon name={name} size={size} />;

const toStringLabel = (label: ReactNode, fallback: string) => (typeof label === "string" ? label : fallback);

const isCustomizableNode = (node: TreeListNode) => node.canHide === true || node.hiddenByDefault === true;

const visibilityContextIcon = (shown: boolean) => icon(shown ? "eye-off" : "eye");

const buildVisibilityContextMenuItem = (
  node: TreeListNode,
  nodeOverrides: Record<string, "hidden" | "shown">,
  onToggleNode: (id: string, hiddenByDefault: boolean) => void,
): TreeListActionMenuItem | undefined => {
  if (!isCustomizableNode(node)) return undefined;

  const hiddenByDefault = node.hiddenByDefault === true;
  const visible = resolveVisibility(nodeOverrides[node.id], hiddenByDefault) === "shown";
  const label = toStringLabel(node.label, node.id);

  return {
    id: `tree-visibility:${node.id}`,
    label: visible ? `Hide ${label}` : `Show ${label}`,
    icon: visibilityContextIcon(visible),
    separatorBefore: (node.contextMenuItems?.length ?? 0) > 0,
    onAction: () => onToggleNode(node.id, hiddenByDefault),
  };
};

const resolveNodeIcon = (node: TreeNode) => {
  if (node.iconElement !== undefined) return node.iconElement as ReactNode;
  return node.icon ? icon(node.icon) : undefined;
};

const resolveNavigationIntent = (node: TreeNode) => {
  if (node.target) return { id: "target", payload: node.target };
  if (node.resource) return { id: "resource", payload: node.resource };
  return undefined;
};

const toTreeListNode = (
  node: TreeNode,
  nodeOverrides: Record<string, "hidden" | "shown">,
  onToggleNode: (id: string, hiddenByDefault: boolean) => void,
): TreeListNode => {
  const treeNode: TreeListNode = {
    id: node.id,
    label: node.label,
    description: node.description,
    icon: resolveNodeIcon(node),
    iconColor: node.iconColor,
    disabled: node.disabled,
    canHide: node.canHide,
    hiddenByDefault: node.hiddenByDefault,
    isNavigable: Boolean(node.target || node.resource),
    navigationIntent: resolveNavigationIntent(node),
  };
  const visibilityItem = buildVisibilityContextMenuItem(treeNode, nodeOverrides, onToggleNode);

  return visibilityItem
    ? { ...treeNode, contextMenuItems: [...(treeNode.contextMenuItems ?? []), visibilityItem] }
    : treeNode;
};

const toHeaderSection = (nodes: TreeListNode[]): TreeListSection => ({
  id: HEADER_SECTION_ID,
  nodes,
});

const openResource = (input: WorkbenchWidgetRenderInput, nodeId: string, resource: ResourceRef) => {
  input.workbench.renderers.setSelectedNode(dashboardWidgetIds.dashboardSidebar, nodeId);
  void input.workbench.resources.openResource(resource, { replaceActive: true });
};

const openTarget = (input: WorkbenchWidgetRenderInput, target: NavigationTarget) => {
  void input.workbench.navigation.openTarget(target);
};

const navigateHeaderNode = (input: WorkbenchWidgetRenderInput, event: TreeListNavigateEvent) => {
  if (event.intent?.id === "target") {
    openTarget(input, event.intent.payload as NavigationTarget);
    return;
  }

  if (event.intent?.id !== "resource") return;
  const resource = event.intent.payload;
  if (!resource || typeof resource !== "object") return;
  openResource(input, event.nodeId, resource as ResourceRef);
};

const usePrimaryResourceSubscription = (input: WorkbenchWidgetRenderInput) => {
  useWorkbenchStore(input.workbench.layout.store, (state) => getAnchorResource(state.layout, "primary")?.uri);
};

const useHeaderNodes = (input: WorkbenchWidgetRenderInput) => {
  const activeModeId = useWorkbenchStore(input.workbench.modes.store, (state) => state.activeModeId);
  usePrimaryResourceSubscription(input);

  return activeModeId ? getSidebarContributionHeaderNodes(input.workbench, activeModeId) : [];
};

export const DashboardSidebarHeaderActions = (props: {
  input: WorkbenchWidgetRenderInput;
  minH?: BoxProps["minH"];
}) => {
  const { input, minH } = props;
  const headerNodes = useHeaderNodes(input);
  const nodeOverrides = useTreeListVisibilityStore(dashboardWidgetIds.dashboardSidebar, (state) => state.nodeOverrides);
  const sectionOverrides = useTreeListVisibilityStore(
    dashboardWidgetIds.dashboardSidebar,
    (state) => state.sectionOverrides,
  );
  const toggleNode = useTreeListVisibilityStore(dashboardWidgetIds.dashboardSidebar, (state) => state.toggleNode);
  const toggleSection = useTreeListVisibilityStore(dashboardWidgetIds.dashboardSidebar, (state) => state.toggleSection);
  const reset = useTreeListVisibilityStore(dashboardWidgetIds.dashboardSidebar, (state) => state.reset);

  if (headerNodes.length === 0) return null;

  const nodes = headerNodes.map((node) => toTreeListNode(node, nodeOverrides, toggleNode));
  const visibleNodes = filterVisibleNodes(nodes, nodeOverrides);
  const backgroundContextActions = buildTreeVisibilityMenuActions(
    { headerNodes: nodes, sections: [] },
    sectionOverrides,
    nodeOverrides,
    { onToggleSection: toggleSection, onToggleNode: toggleNode, onResetAll: reset },
    { visibleIcon: icon("eye", 14), hiddenIcon: icon("eye-off", 14), resetIcon: icon("rotate-ccw", 14) },
  );

  return (
    <Box w="full" minW="0" minH={minH}>
      <TreeList
        sections={[toHeaderSection(visibleNodes)]}
        rowVariant="compact"
        backgroundContextActions={backgroundContextActions}
        onNavigate={(event) => navigateHeaderNode(input, event)}
      />
    </Box>
  );
};
