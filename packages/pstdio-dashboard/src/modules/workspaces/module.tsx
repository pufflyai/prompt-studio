import type { ResourceRef, TreeNode, WorkbenchModuleContext, WorkbenchModuleContribution } from "@pstdio/workbench";
import { workbenchCommandPaletteMenuPath } from "@pstdio/workbench";
import { dashboardCommandIds } from "@/shared/app/commands";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import { dashboardResources } from "@/shared/app/resources";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { subscribeDashboardData } from "@/shared/sync/dashboard-rows";
import { registerDashboardViewContribution } from "@/shared/workbench/contributions/dashboard-view-contributions";
import { activateModeChromeContributions } from "@/shared/workbench/contributions/mode-chrome-contributions";
import { registerSidenavContribution } from "@/shared/workbench/contributions/sidenav-tree-contributions";
import { setDashboardSidenavSelection, showDashboardSidenav } from "@/shared/workbench/dashboard-sidenav";
import { dashboardResourceParent } from "@/shared/workbench/resource-hierarchy";
import { setResourceBreadcrumb } from "@/shared/workbench/resource-sync";
import { registerResourceRoute } from "@/shared/workbench/route-helper";
import { registerWorkspaceKanbanRenderer } from "./collections/workspace-kanban-renderer";
import { CreateWorkspaceWidget } from "./components/create-workspace-widget";
import { RenameWorkspaceWidget } from "./components/rename-workspace-widget";
import { WorkspaceWidget } from "./components/workspace-widget";
import { createDashboardWorkspaces } from "./data/dashboard-workspaces";
import { ensureWorkspaceTerminalResource, registerWorkspaceResourceActions } from "./workspace-resource-actions";

const openCreateWorkspace = (ctx: WorkbenchModuleContext) => {
  const projectId = getDashboardSelectedProjectId(ctx);
  if (!projectId) {
    ctx.navigator.commitContext({ modeId: "project-selection", resource: null });
    return;
  }

  return ctx.layout.openPanel(dashboardWidgetIds.createWorkspace, { title: "Create workspace", closable: true });
};

// The unified sidenav is mode-reactive (it opens and recomposes itself on mode change), so the
// dashboard modes only activate their own chrome (e.g. the session bubble) here.
const enterProjectSidenavChrome = (modeCtx: WorkbenchModuleContext) =>
  activateModeChromeContributions(modeCtx, "project");

const enterWorkspaceSidenavChrome = (modeCtx: WorkbenchModuleContext) =>
  activateModeChromeContributions(modeCtx, "workspace");

const workspaceNavigationNode = (): TreeNode => ({
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
});

const registerWorkspaceSidenavContributions = (ctx: WorkbenchModuleContext) => {
  registerSidenavContribution(ctx, {
    id: "dashboard.workspaces.project-nav",
    modes: ["*"],
    region: "header",
    order: 30,
    getHeaderNodes: () => [workspaceNavigationNode()],
  });
};

const metadataString = (resource: ResourceRef, key: string) => {
  const value = resource.metadata?.[key];
  return typeof value === "string" ? value : undefined;
};

// A rename streams back through the synced rows, but the breadcrumb was built from the
// resource captured when the workspace opened. Re-apply it whenever the open workspace's
// synced name changes so the new name shows in the breadcrumb trail too.
const watchOpenWorkspaceRename = (ctx: WorkbenchModuleContext) => {
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
    setResourceBreadcrumb(ctx, current.resource);
  };

  subscribeDashboardData(sync);
  ctx.onDidChangePrimaryResource(() => {
    shownLabel = undefined;
    sync();
  });
};

const registerWorkspaceDetailWidgets = (ctx: WorkbenchModuleContext) => {
  ctx.layout.registerPanel({
    id: dashboardWidgetIds.createWorkspace,
    title: "Create workspace",
    region: "overlay",
    singleton: true,
    rendererId: dashboardWidgetIds.createWorkspace,
    config: { size: "sm", placement: "center", scrollBehavior: "inside", closeOnInteractOutside: false },
  });
  ctx.renderers.registerRenderer({
    id: dashboardWidgetIds.createWorkspace,
    render: (input) => <CreateWorkspaceWidget input={input} />,
  });

  ctx.layout.registerPanel({
    id: dashboardWidgetIds.renameWorkspace,
    title: "Rename workspace",
    region: "overlay",
    singleton: true,
    rendererId: dashboardWidgetIds.renameWorkspace,
    config: { size: "sm", placement: "center", scrollBehavior: "inside", closeOnInteractOutside: false },
  });
  ctx.renderers.registerRenderer({
    id: dashboardWidgetIds.renameWorkspace,
    render: (input) => <RenameWorkspaceWidget input={input} />,
  });

  ctx.layout.registerPanel(
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
      ctx.resources.registerHierarchyProvider({
        id: "dashboard-workbench.workspace-hierarchy",
        priority: 100,
        canResolve: (resource) => resource.kind === "workspace",
        getParent: (resource) => {
          const projectId = metadataString(resource, "projectId") ?? getDashboardSelectedProjectId(ctx);
          if (!projectId) return dashboardResources.workspaces;
          return dashboardResourceParent(ctx, resource, projectId) ?? dashboardResources.workspaces;
        },
      });

      registerWorkspaceResourceActions(ctx);
      registerWorkspaceKanbanRenderer(ctx);
      registerWorkspaceDetailWidgets(ctx);
      watchOpenWorkspaceRename(ctx);

      registerDashboardViewContribution(ctx, {
        resource: dashboardResources.workspaces,
        group: "Dashboard",
        order: 10,
      });

      registerWorkspaceSidenavContributions(ctx);

      ctx.modes.registerMode({
        id: "project",
        label: "Project",
        panels: ["main", "secondary", "side"],
        activate: () => undefined,
        enter: enterProjectSidenavChrome,
      });
      ctx.modes.registerMode({
        id: "workspace",
        label: "Workspace",
        panels: ["main", "secondary", "side"],
        activate: () => undefined,
        enter: enterWorkspaceSidenavChrome,
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
        id: "dashboard.workspaces.presenter",
        match: (resource) => resource.kind === "dashboard-view" && resource.id === "workspaces",
        mode: "project",
        panelId: dashboardWidgetIds.workspaces,
        beforeOpen: ({ resource }) => {
          setResourceBreadcrumb(ctx, resource);
          setDashboardSidenavSelection(ctx, resource.uri);
        },
      });
      registerResourceRoute(ctx, {
        id: "dashboard.workspace.presenter",
        match: (resource) => resource.kind === "workspace",
        mode: "workspace",
        panelId: dashboardWidgetIds.workspace,
        title: (resource) => resource.label ?? "Workspace",
        beforeOpen: ({ resource }) => {
          setResourceBreadcrumb(ctx, resource);
          showDashboardSidenav(ctx, { selectedNode: null });
        },
        afterOpen: ({ resource, placement }) => {
          ensureWorkspaceTerminalResource(ctx, resource);
          ctx.layout.activatePanel(placement.instanceId);
        },
      });
    },
  }) satisfies WorkbenchModuleContribution;
