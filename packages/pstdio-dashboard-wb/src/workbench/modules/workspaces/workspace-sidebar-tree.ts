import type { ResourceRef, TreeNode, TreeViewSection, WorkbenchModuleContributionContext } from "pstdio-workbench/core";
import { dashboardHelpMenuPath } from "../../shared/menu-paths";
import { dashboardResources } from "../../shared/mock-data/resources";
import { dashboardWidgetIds } from "../../shared/widget-ids";
import { openFloatingSessionCommandId } from "../sessions/session-bubble";
import { type DashboardWorkspace, dashboardWorkspaces } from "./mock-data/workspaces";

const sessionStatusIcon = (status: string) => {
  if (status === "completed") return "CircleCheck";
  if (status === "failed") return "CircleAlert";
  if (status === "cancelled") return "CircleStop";
  if (status === "disconnected") return "CirclePause";
  if (status === "queued") return "ClockAlert";
  if (status === "awaiting_input") return "CircleDot";
  return "CircleDashed";
};

const sessionStatusColor = (status: string) => {
  if (status === "completed") return "fg.success";
  if (status === "failed") return "fg.error";
  if (status === "cancelled" || status === "disconnected") return "fg.warning";
  if (status === "queued") return "fg.info";
  return "fg.muted";
};

const createSessionNode = (session: DashboardWorkspace["sessions"][number]): TreeNode => ({
  id: session.resource.uri,
  label: session.title,
  icon: sessionStatusIcon(session.status),
  iconColor: sessionStatusColor(session.status),
  target: { kind: "command", commandId: openFloatingSessionCommandId, args: { resource: session.resource } },
});

// In workspace mode the sidebar reflects the open workspace; the tree's selected
// node is that workspace, set by syncWorkspaceSidebar.
const resolveActiveWorkspace = (ctx: WorkbenchModuleContributionContext) => {
  const { selectedNodeId } = ctx.renderers.getTreeState(dashboardWidgetIds.workspaceSidebar);
  return dashboardWorkspaces.find((workspace) => workspace.resource.uri === selectedNodeId);
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
          target: { kind: "command", commandId: "dashboard.openCommandPalette" },
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

  if (ctx.modes.getActiveModeId() === "workspace") {
    const workspace = resolveActiveWorkspace(ctx);
    if (workspace) {
      sections.push({
        id: "sessions",
        label: "Sessions",
        collapsible: false,
        nodes: workspace.sessions.map(createSessionNode),
      });
    }
  }

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
  {
    id: dashboardResources.sessions.uri,
    label: "Sessions",
    icon: "MessageCircle",
    resource: dashboardResources.sessions,
  },

  {
    id: dashboardResources.settings.uri,
    label: "Project settings",
    icon: "Settings",
    resource: dashboardResources.settings,
  },
];

export const registerWorkspaceSidebarTree = (ctx: WorkbenchModuleContributionContext) => {
  ctx.renderers.registerTreeRenderer({
    id: dashboardWidgetIds.workspaceSidebar,
    title: "Workspaces",
    defaultExpandedSectionIds: ["sessions"],
    getBody: () => createWorkspaceSidebarSections(ctx),
    getFooter: () => createWorkspaceFooterNodes(),
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
