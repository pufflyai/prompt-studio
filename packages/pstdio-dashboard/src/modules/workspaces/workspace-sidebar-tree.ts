import type { ResourceRef, TreeNode, TreeViewSection, WorkbenchModuleContributionContext } from "pstdio-workbench/core";
import { dashboardCommandIds } from "@/shared/app/commands";
import { dashboardHelpMenuPath } from "@/shared/app/menu-paths";
import { dashboardResources } from "@/shared/app/resources";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import {
  getProjectSidebarContributionFooterNodes,
  getProjectSidebarContributionSections,
  getWorkspaceSidebarContributionFooterNodes,
  getWorkspaceSidebarContributionSections,
  sidebarTreeContributionPlacements,
} from "@/shared/workbench/contributions/sidebar-tree-contributions";

const searchNode = (): TreeNode => ({
  id: "search-workspaces",
  label: "Search",
  icon: "Search",
  target: { kind: "command", commandId: dashboardCommandIds.openCommandPalette },
});

const createProjectSidebarSections = (ctx: WorkbenchModuleContributionContext): TreeViewSection[] => {
  const sections: TreeViewSection[] = [
    {
      id: "workspace-actions",
      nodes: [searchNode()],
    },
  ];

  sections.push(...getProjectSidebarContributionSections(ctx, sidebarTreeContributionPlacements.beforeWorkspaces));

  sections.push({
    id: "workspace-navigation",
    nodes: [
      {
        id: dashboardResources.workspaces.uri,
        label: "Workspaces",
        icon: dashboardResources.workspaces.icon,
        resource: dashboardResources.workspaces,
        actions: [
          {
            id: "create-workspace",
            label: "New workspace",
            icon: "Plus",
            commandId: dashboardCommandIds.createWorkspace,
          },
        ],
      },
    ],
  });

  sections.push(...getProjectSidebarContributionSections(ctx));

  return sections;
};

const createProjectFooterNodes = (): TreeNode[] => [
  {
    id: "help",
    label: "Help",
    icon: "CircleHelp",
    menuPath: dashboardHelpMenuPath,
    menuPlacement: "top-start",
  },
];

export const registerProjectSidebarTree = (ctx: WorkbenchModuleContributionContext) => {
  ctx.renderers.registerTreeRenderer({
    id: dashboardWidgetIds.projectSidebar,
    title: "Project",
    getBody: () => createProjectSidebarSections(ctx),
    getFooter: () => [...createProjectFooterNodes(), ...getProjectSidebarContributionFooterNodes(ctx)],
    getChildren: () => [],
  });
  ctx.layout.registerWidget(
    {
      id: dashboardWidgetIds.projectSidebar,
      title: "Project",
      area: "left",
      rendererId: dashboardWidgetIds.projectSidebar,
      singleton: true,
      areaSize: { defaultPx: 240, minPx: 200, maxPx: 320 },
    },
    { priority: 80 },
  );
};

const createWorkspaceSidebarSections = (
  ctx: WorkbenchModuleContributionContext,
  resource: ResourceRef | undefined,
): TreeViewSection[] => [
  {
    id: "workspace-actions",
    nodes: [searchNode()],
  },
  ...getWorkspaceSidebarContributionSections(ctx, sidebarTreeContributionPlacements.beforeWorkspaces, { resource }),
  ...getWorkspaceSidebarContributionSections(ctx, sidebarTreeContributionPlacements.afterWorkspaces, { resource }),
];

export const registerWorkspaceSidebarTree = (ctx: WorkbenchModuleContributionContext) => {
  ctx.renderers.registerTreeRenderer({
    id: dashboardWidgetIds.workspaceSidebar,
    title: "Workspace",
    getBody: (treeCtx) => createWorkspaceSidebarSections(ctx, treeCtx.resource),
    getFooter: () => [...createProjectFooterNodes(), ...getWorkspaceSidebarContributionFooterNodes(ctx)],
    getChildren: () => [],
  });
  ctx.layout.registerWidget(
    {
      id: dashboardWidgetIds.workspaceSidebar,
      title: "Workspace",
      area: "left",
      rendererId: dashboardWidgetIds.workspaceSidebar,
      singleton: true,
      areaSize: { defaultPx: 240, minPx: 200, maxPx: 320 },
    },
    { priority: 75 },
  );
};

export const syncWorkspaceSidebar = (ctx: WorkbenchModuleContributionContext, resource: ResourceRef) => {
  ctx.layout.openWidget(dashboardWidgetIds.workspaceSidebar, { resource, title: "Workspace", pinned: true });
  ctx.renderers.setSelectedNode(dashboardWidgetIds.workspaceSidebar, undefined);
  ctx.renderers.refresh(dashboardWidgetIds.workspaceSidebar);
  ctx.layout.setAreaVisible("left", true);
  ctx.panels.setOpen("left", true);
};
