import type { ResourceRef, TreeNode, TreeViewSection, WorkbenchModuleContributionContext } from "pstdio-workbench/core";
import { dashboardCommandIds } from "../../shared/commands";
import { dashboardHelpMenuPath } from "../../shared/menu-paths";
import { getDashboardSelectedProjectId } from "../../shared/project-context";
import { dashboardResources } from "../../shared/resources";
import { dashboardWidgetIds } from "../../shared/widget-ids";
import {
  getWorkspaceSidebarContributionFooterNodes,
  getWorkspaceSidebarContributionSections,
} from "../../shared/workspace-sidebar-contributions";
import { createDashboardWorkspaces } from "./data/dashboard-workspaces";

export const resolveActiveWorkspace = (ctx: WorkbenchModuleContributionContext) => {
  const projectId = getDashboardSelectedProjectId(ctx);
  const { selectedNodeId } = ctx.renderers.getTreeState(dashboardWidgetIds.workspaceSidebar);
  const selectedWorkspace = createDashboardWorkspaces(projectId).find(
    (workspace) => workspace.resource.uri === selectedNodeId,
  );
  if (selectedWorkspace) return selectedWorkspace;

  const workspacePlacement = ctx.layout
    .getLayout()
    .areas.main.widgets.find((placement) => placement.resource?.kind === "workspace");
  const resource = workspacePlacement?.resource;
  if (resource?.kind !== "workspace") return undefined;
  return createDashboardWorkspaces(projectId).find(
    (workspace) => workspace.resource.uri === resource.uri || workspace.id === resource.id,
  );
};

const createWorkspaceSidebarSections = (ctx: WorkbenchModuleContributionContext): TreeViewSection[] => {
  const sections: TreeViewSection[] = [
    {
      id: "workspace-actions",
      nodes: [
        {
          id: "search-workspaces",
          label: "Search",
          icon: "Search",
          target: { kind: "command", commandId: dashboardCommandIds.openCommandPalette },
        },
        {
          id: dashboardResources.workspaces.uri,
          label: "Workspaces",
          icon: "GitBranch",
          resource: dashboardResources.workspaces,
        },
      ],
    },
  ];

  sections.push(...getWorkspaceSidebarContributionSections(ctx));

  return sections;
};

const createWorkspaceFooterNodes = (): TreeNode[] => [
  {
    id: "help",
    label: "Help",
    icon: "CircleHelp",
    menuPath: dashboardHelpMenuPath,
    menuPlacement: "top-start",
  },
];

export const registerWorkspaceSidebarTree = (ctx: WorkbenchModuleContributionContext) => {
  ctx.renderers.registerTreeRenderer({
    id: dashboardWidgetIds.workspaceSidebar,
    title: "Workspaces",
    defaultExpandedSectionIds: ["sessions"],
    getBody: () => createWorkspaceSidebarSections(ctx),
    getFooter: () => [...createWorkspaceFooterNodes(), ...getWorkspaceSidebarContributionFooterNodes(ctx)],
    getChildren: () => [],
  });
  ctx.layout.registerWidget(
    {
      id: dashboardWidgetIds.workspaceSidebar,
      title: "Workspaces",
      area: "left",
      rendererId: dashboardWidgetIds.workspaceSidebar,
      singleton: true,
      areaSize: { defaultPx: 240, minPx: 200, maxPx: 320 },
    },
    { priority: 80 },
  );
};

export const syncWorkspaceSidebar = (ctx: WorkbenchModuleContributionContext, resource: ResourceRef) => {
  ctx.layout.openWidget(dashboardWidgetIds.workspaceSidebar, { resource, title: "Workspaces", pinned: true });
  ctx.renderers.setSelectedNode(dashboardWidgetIds.workspaceSidebar, resource.uri);
  ctx.renderers.refresh(dashboardWidgetIds.workspaceSidebar);
  ctx.layout.setAreaVisible("left", true);
  ctx.panels.setOpen("left", true);
};

export const syncWorkspaceSidebarSessionSelection = (
  ctx: WorkbenchModuleContributionContext,
  resource: ResourceRef,
) => {
  ctx.renderers.setSelectedNode(dashboardWidgetIds.workspaceSidebar, resource.uri);
  ctx.renderers.refresh(dashboardWidgetIds.workspaceSidebar);
};
