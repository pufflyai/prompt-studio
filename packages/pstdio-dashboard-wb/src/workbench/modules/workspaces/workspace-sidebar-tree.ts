import type { ResourceRef, TreeNode, TreeViewSection, WorkbenchModuleContributionContext } from "pstdio-workbench/core";
import { createDashboardWorkspaces, type DashboardWorkspace } from "../../data/dashboard-data";
import {
  buildDashboardExtensionNavigationSections,
  getCachedDashboardExtensionMetadata,
} from "../../shared/extensions/workbench-extension-contributions";
import { dashboardHelpMenuPath } from "../../shared/menu-paths";
import { getDashboardSelectedProjectId } from "../../shared/project-context";
import { dashboardResources } from "../../shared/resources";
import { dashboardWidgetIds } from "../../shared/widget-ids";
import { openFloatingSessionCommandId } from "../sessions/session-bubble";

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

const findWorkspaceByResource = (resource: ResourceRef | undefined, projectId: string | undefined) => {
  if (resource?.kind !== "workspace") return undefined;
  return createDashboardWorkspaces(projectId).find(
    (workspace) => workspace.resource.uri === resource.uri || workspace.id === resource.id,
  );
};

// In workspace mode the sidebar reflects the open workspace. The selected tree
// node may be a session inside that workspace, so the active workspace comes
// from the main widget placement when selection is on a child node.
const resolveActiveWorkspace = (ctx: WorkbenchModuleContributionContext) => {
  const projectId = getDashboardSelectedProjectId(ctx);
  const { selectedNodeId } = ctx.renderers.getTreeState(dashboardWidgetIds.workspaceSidebar);
  const selectedWorkspace = createDashboardWorkspaces(projectId).find(
    (workspace) => workspace.resource.uri === selectedNodeId,
  );
  if (selectedWorkspace) return selectedWorkspace;

  const workspacePlacement = ctx.layout
    .getLayout()
    .areas.main.widgets.find((placement) => placement.resource?.kind === "workspace");
  return findWorkspaceByResource(workspacePlacement?.resource, projectId);
};

const createWorkspaceSidebarSections = (ctx: WorkbenchModuleContributionContext): TreeViewSection[] => {
  const projectId = getDashboardSelectedProjectId(ctx);
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

  if (projectId) {
    const metadata = getCachedDashboardExtensionMetadata(projectId);
    const extensionSections = metadata ? buildDashboardExtensionNavigationSections({ metadata, projectId }) : [];
    sections.push(...extensionSections);
  }

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

export const syncWorkspaceSidebarSessionSelection = (
  ctx: WorkbenchModuleContributionContext,
  resource: ResourceRef,
) => {
  ctx.renderers.setSelectedNode(dashboardWidgetIds.workspaceSidebar, resource.uri);
  ctx.renderers.refresh(dashboardWidgetIds.workspaceSidebar);
};
