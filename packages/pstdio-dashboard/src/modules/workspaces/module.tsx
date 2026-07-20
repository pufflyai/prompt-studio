import type {
  ResourceRef,
  TreeNode,
  TreeViewSection,
  WorkbenchModuleContribution,
  WorkbenchModuleContributionContext,
} from "@pstdio/workbench/core";
import { workbenchCommandPaletteMenuPath } from "@pstdio/workbench/core";
import { dashboardCommandIds } from "@/shared/app/commands";
import { dashboardHelpMenuPath } from "@/shared/app/menu-paths";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import { dashboardResources } from "@/shared/app/resources";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { subscribeDashboardData } from "@/shared/sync/dashboard-rows";
import { registerDashboardViewContribution } from "@/shared/workbench/contributions/dashboard-view-contributions";
import { activateModeChromeContributions } from "@/shared/workbench/contributions/mode-chrome-contributions";
import { registerSidebarContribution } from "@/shared/workbench/contributions/sidebar-tree-contributions";
import { setDashboardSidebarSelection, showDashboardSidebar } from "@/shared/workbench/dashboard-sidebar";
import { setResourceBreadcrumb } from "@/shared/workbench/resource-sync";
import { registerResourceRoute } from "@/shared/workbench/route-helper";
import { createDashboardSessions } from "../sessions/data/dashboard-sessions";
import { registerWorkspaceDataRenderer } from "./collections/workspace-data-renderer";
import { CreateWorkspaceWidget } from "./components/create-workspace-widget";
import { RenameWorkspaceWidget } from "./components/rename-workspace-widget";
import { WorkspaceWidget } from "./components/workspace-widget";
import { createDashboardWorkspaces } from "./data/dashboard-workspaces";
import { setWorkspaceBreadcrumb } from "./workspace-breadcrumb";
import { ensureWorkspaceTerminalResource, registerWorkspaceResourceActions } from "./workspace-resource-actions";

const openCreateWorkspace = (ctx: WorkbenchModuleContributionContext) => {
  const projectId = getDashboardSelectedProjectId(ctx);
  if (!projectId) {
    ctx.modes.setActiveMode("project-selection");
    return;
  }

  return ctx.layout.openWidget(dashboardWidgetIds.createWorkspace, { title: "Create workspace" });
};

// The unified sidebar is mode-reactive (it opens and recomposes itself on mode change), so the
// dashboard modes only activate their own chrome (e.g. the session bubble) here.
const setupProjectSidebarChrome = (modeCtx: WorkbenchModuleContributionContext) =>
  activateModeChromeContributions(modeCtx, "project");

const setupWorkspaceSidebarChrome = (modeCtx: WorkbenchModuleContributionContext) => {
  modeCtx.layout.clearRegion("side");
  modeCtx.layout.clearRegion("side-header");
  // The workspace detail owns the Main right menu; clearing on mode entry (rather than
  // per open) keeps it as mode chrome so history replay restores it via setActiveMode.
  modeCtx.layout.clearRegion("main-right-menu");
  return activateModeChromeContributions(modeCtx, "workspace");
};

const workspaceNavigationSection = (): TreeViewSection => ({
  id: "workspace-navigation",
  nodes: [
    {
      id: dashboardResources.workspaces.uri,
      label: "Workspaces",
      icon: dashboardResources.workspaces.icon,
      canHide: true,
      commandId: dashboardCommandIds.openWorkspaces,
      resource: dashboardResources.workspaces,
      actions: [
        {
          id: "new-workspace",
          label: "New workspace",
          icon: "Plus",
          commandId: dashboardCommandIds.createWorkspace,
        },
      ],
    },
  ],
});

const helpFooterNode = (): TreeNode => ({
  id: "help",
  label: "Help",
  icon: "CircleHelp",
  canHide: true,
  menuPath: dashboardHelpMenuPath,
  menuPlacement: "top-start",
});

// Ticket mode is declared by the tickets extension (via extension-mode-layout), not the
// dashboard. The dashboard only contributes the workspaces linked to the open ticket, resolved
// in-dashboard from each workspace's metadata.ticketId — so the section is inert until that
// extension mode is active.
const ticketLinkedWorkspaceSections = (ctx: WorkbenchModuleContributionContext): TreeViewSection[] => {
  const ticket = ctx.getPrimaryResource();
  if (!ticket) return [];
  const ticketId = ticket.id ?? metadataString(ticket, "ticketId");
  if (!ticketId) return [];

  const workspaces = createDashboardWorkspaces(getDashboardSelectedProjectId(ctx)).filter(
    (workspace) => metadataString(workspace.resource, "ticketId") === ticketId,
  );
  if (workspaces.length === 0) return [];

  return [
    {
      id: "ticket-linked-workspaces",
      label: "Workspaces",
      nodes: workspaces.map((workspace) => ({
        id: workspace.resource.uri,
        label: workspace.title,
        icon: dashboardResources.workspaces.icon,
        resource: workspace.resource,
      })),
    },
  ];
};

const registerWorkspaceSidebarContributions = (ctx: WorkbenchModuleContributionContext) => {
  registerSidebarContribution(ctx, {
    id: "dashboard.workspaces.project-nav",
    modes: ["project"],
    order: 20,
    getSections: () => [workspaceNavigationSection()],
  });
  registerSidebarContribution(ctx, {
    id: "dashboard.workspaces.ticket-linked",
    modes: ["ticket"],
    order: 10,
    getSections: () => ticketLinkedWorkspaceSections(ctx),
  });
  registerSidebarContribution(ctx, {
    id: "dashboard.workspaces.help-footer",
    modes: ["project"],
    order: 10,
    region: "footer",
    getFooterNodes: () => [helpFooterNode()],
  });
};

const metadataString = (resource: ResourceRef, key: string) => {
  const value = resource.metadata?.[key];
  return typeof value === "string" ? value : undefined;
};

const findFirstWorkspaceSessionResource = (ctx: WorkbenchModuleContributionContext, resource: ResourceRef) => {
  const workspaceId = resource.id ?? metadataString(resource, "workspaceId");
  if (!workspaceId) return undefined;

  return createDashboardSessions(getDashboardSelectedProjectId(ctx)).find(
    (session) => session.workspaceId === workspaceId,
  )?.resource;
};

const openFirstWorkspaceSession = (ctx: WorkbenchModuleContributionContext, resource: ResourceRef) => {
  if (!ctx.commands.getCommand(dashboardCommandIds.openSessionPanel)) return;

  const session = findFirstWorkspaceSessionResource(ctx, resource);
  if (!session) return;

  void ctx.commands.executeCommand(dashboardCommandIds.openSessionPanel, { resource: session });
};

// A rename streams back through the synced rows, but the breadcrumb was built from the
// resource captured when the workspace opened. Re-apply it whenever the open workspace's
// synced name changes so the new name shows in the breadcrumb trail too.
const watchOpenWorkspaceRename = (ctx: WorkbenchModuleContributionContext) => {
  let shownLabel: string | undefined;

  const sync = () => {
    const primary = ctx.getPrimaryResource();
    if (primary?.kind !== "workspace" || !primary.id) {
      shownLabel = undefined;
      return;
    }

    const current = createDashboardWorkspaces(getDashboardSelectedProjectId(ctx)).find(
      (workspace) => workspace.id === primary.id,
    );
    const label = current?.resource.label;
    if (!current || label === undefined) return;

    // Baseline against the label shown when the workspace opened; only react to later renames.
    shownLabel ??= primary.label;
    if (label === shownLabel) return;

    shownLabel = label;
    setWorkspaceBreadcrumb(ctx, current.resource);
  };

  subscribeDashboardData(sync);
  ctx.onDidChangePrimaryResource(() => {
    shownLabel = undefined;
    sync();
  });
};

const registerWorkspaceDetailWidgets = (ctx: WorkbenchModuleContributionContext) => {
  ctx.layout.registerWidget({
    id: dashboardWidgetIds.createWorkspace,
    title: "Create workspace",
    region: "overlay",
    singleton: true,
    closable: true,
    rendererId: dashboardWidgetIds.createWorkspace,
    config: { size: "sm", placement: "center", scrollBehavior: "inside", closeOnInteractOutside: false },
  });
  ctx.renderers.registerRenderer({
    id: dashboardWidgetIds.createWorkspace,
    render: (input) => <CreateWorkspaceWidget input={input} />,
  });

  ctx.layout.registerWidget({
    id: dashboardWidgetIds.renameWorkspace,
    title: "Rename workspace",
    region: "overlay",
    singleton: true,
    closable: true,
    rendererId: dashboardWidgetIds.renameWorkspace,
    config: { size: "sm", placement: "center", scrollBehavior: "inside", closeOnInteractOutside: false },
  });
  ctx.renderers.registerRenderer({
    id: dashboardWidgetIds.renameWorkspace,
    render: (input) => <RenameWorkspaceWidget input={input} />,
  });

  ctx.layout.registerWidget(
    {
      id: dashboardWidgetIds.workspace,
      title: "Workspace",
      region: "main",
      rendererId: dashboardWidgetIds.workspace,
      singleton: true,
      resourceKinds: ["workspace"],
    },
    { priority: 70 },
  );
  ctx.renderers.registerRenderer({
    id: dashboardWidgetIds.workspace,
    render: (input) => <WorkspaceWidget input={input} />,
  });
};

// The workspaces slice owns the project navigation shell, the workspaces board,
// and the workspace-detail chrome used when a workspace resource opens.
export const createWorkspacesModule = () =>
  ({
    id: "dashboard.workspaces",
    activate(ctx) {
      ctx.resources.registerKind({
        kind: "workspace",
        label: "Workspace",
        icon: "GitBranch",
        paletteOpenInput: { replaceActive: true },
      });

      ctx.resources.registerProvider({
        id: "dashboard-workbench.workspaces",
        kind: "workspace",
        list: () =>
          createDashboardWorkspaces(getDashboardSelectedProjectId(ctx)).map((workspace) => ({
            resource: workspace.resource,
            searchText: [workspace.title, workspace.shorthand, workspace.branch].filter(Boolean).join(" "),
            group: "Workspaces",
          })),
      });

      registerWorkspaceResourceActions(ctx);
      registerWorkspaceDataRenderer(ctx);
      registerWorkspaceDetailWidgets(ctx);
      watchOpenWorkspaceRename(ctx);

      registerDashboardViewContribution(ctx, {
        resource: dashboardResources.workspaces,
        group: "Dashboard",
        order: 10,
      });

      registerWorkspaceSidebarContributions(ctx);

      ctx.modes.registerMode({
        id: "project",
        label: "Project",
        activate: setupProjectSidebarChrome,
      });
      ctx.modes.registerMode({
        id: "workspace",
        label: "Workspace",
        activate: setupWorkspaceSidebarChrome,
      });

      ctx.commands.registerCommand(
        {
          id: dashboardCommandIds.openWorkspaces,
          label: "Open workspaces",
          category: "Dashboard",
          icon: dashboardResources.workspaces.icon,
        },
        { execute: () => ctx.resources.openResource(dashboardResources.workspaces, { replaceActive: true }) },
      );

      ctx.commands.registerCommand(
        { id: dashboardCommandIds.createWorkspace, label: "New workspace", category: "Dashboard", icon: "Plus" },
        { execute: () => openCreateWorkspace(ctx) },
      );

      ctx.layout.registerMenuItem(workbenchCommandPaletteMenuPath, {
        commandId: dashboardCommandIds.openWorkspaces,
        order: 10,
      });

      registerResourceRoute(ctx, {
        id: "dashboard.workspaces.opener",
        match: (resource) => resource.kind === "dashboard-view" && resource.id === "workspaces",
        mode: "project",
        widgetId: dashboardWidgetIds.workspaces,
        beforeOpen: ({ resource }) => {
          setResourceBreadcrumb(ctx, resource);
          setDashboardSidebarSelection(ctx, resource.uri);
        },
      });
      registerResourceRoute(ctx, {
        id: "dashboard.workspace.opener",
        match: (resource) => resource.kind === "workspace",
        mode: "workspace",
        widgetId: dashboardWidgetIds.workspace,
        title: (resource) => resource.label ?? "Workspace",
        beforeOpen: ({ resource }) => {
          setWorkspaceBreadcrumb(ctx, resource);
          showDashboardSidebar(ctx, { selectedNode: null });
          openFirstWorkspaceSession(ctx, resource);
        },
        afterOpen: ({ resource }) => {
          ensureWorkspaceTerminalResource(ctx, resource);
        },
      });
    },
  }) satisfies WorkbenchModuleContribution;
