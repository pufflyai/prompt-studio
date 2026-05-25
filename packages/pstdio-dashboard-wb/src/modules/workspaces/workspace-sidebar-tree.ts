import type { ResourceRef, TreeNode, TreeViewSection, WorkbenchModuleContributionContext } from "pstdio-workbench/core";
import { dashboardCommandIds } from "@/shared/app/commands";
import { dashboardHelpMenuPath } from "@/shared/app/menu-paths";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import { dashboardResources } from "@/shared/app/resources";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import {
  getProjectSidebarContributionFooterNodes,
  getProjectSidebarContributionSections,
  getWorkspaceSidebarContributionFooterNodes,
  getWorkspaceSidebarContributionSections,
} from "@/shared/workbench/contributions/sidebar-tree-contributions";
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

  sections.push(...getProjectSidebarContributionSections(ctx, "beforeWorkspaces"));

  sections.push({
    id: "workspace-navigation",
    nodes: [
      {
        id: dashboardResources.workspaces.uri,
        label: "Workspaces",
        icon: "GitBranch",
        resource: dashboardResources.workspaces,
      },
    ],
  });

  sections.push(...getProjectSidebarContributionSections(ctx));

  return sections;
};

const createWorkspaceSidebarSections = (ctx: WorkbenchModuleContributionContext): TreeViewSection[] => {
  const sections: TreeViewSection[] = [
    {
      id: "workspace-actions",
      nodes: [searchNode()],
    },
  ];
  const activeWorkspace = resolveActiveWorkspace(ctx);

  if (activeWorkspace) {
    sections.push({
      id: "workspace-navigation",
      nodes: [
        {
          id: activeWorkspace.resource.uri,
          label: activeWorkspace.shorthand,
          icon: "GitBranch",
          resource: activeWorkspace.resource,
        },
      ],
    });
  }

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

export const registerProjectSidebarTree = (ctx: WorkbenchModuleContributionContext) => {
  ctx.renderers.registerTreeRenderer({
    id: dashboardWidgetIds.projectSidebar,
    title: "Project",
    getBody: () => createProjectSidebarSections(ctx),
    getFooter: () => [...createWorkspaceFooterNodes(), ...getProjectSidebarContributionFooterNodes(ctx)],
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

export const registerWorkspaceSidebarTree = (ctx: WorkbenchModuleContributionContext) => {
  ctx.renderers.registerTreeRenderer({
    id: dashboardWidgetIds.workspaceSidebar,
    title: "Workspace",
    defaultExpandedSectionIds: ["sessions"],
    getBody: () => createWorkspaceSidebarSections(ctx),
    getFooter: () => [...createWorkspaceFooterNodes(), ...getWorkspaceSidebarContributionFooterNodes(ctx)],
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
    { priority: 80 },
  );
};

export const syncWorkspaceSidebar = (ctx: WorkbenchModuleContributionContext, resource: ResourceRef) => {
  ctx.layout.openWidget(dashboardWidgetIds.workspaceSidebar, { resource, title: "Workspace", pinned: true });
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
