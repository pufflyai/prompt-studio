import type { ResourceRef, TreeNode, WorkbenchModuleContext, WorkbenchModuleContribution } from "@pstdio/workbench";
import { workbenchCommandPaletteMenuPath } from "@pstdio/workbench";
import { dashboardCommandIds } from "@/shared/app/commands";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import { dashboardViews } from "@/shared/app/resources";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { subscribeDashboardData } from "@/shared/sync/dashboard-rows";
import { activateModeChromeContributions } from "@/shared/workbench/contributions/mode-chrome-contributions";
import { registerSidenavContribution } from "@/shared/workbench/contributions/sidenav-tree-contributions";
import { setDashboardSidenavSelection, showDashboardSidenav } from "@/shared/workbench/dashboard-sidenav";
import { dashboardResourceParent } from "@/shared/workbench/resource-hierarchy";
import { setResourceBreadcrumb } from "@/shared/workbench/resource-sync";
import { registerDashboardViewRoute, registerResourceRoute } from "@/shared/workbench/route-helper";
import { registerWorkspaceKanbanRenderer } from "./collections/workspace-kanban-renderer";
import { CreateWorkspaceWidget } from "./components/create-workspace-widget";
import { DeleteWorkspaceEntryWidget } from "./components/delete-workspace-entry-widget";
import { RenameWorkspaceWidget } from "./components/rename-workspace-widget";
import { WorkspaceDiffsPanel } from "./components/workspace-widget";
import { createDashboardWorkspaces } from "./data/dashboard-workspaces";
import { registerWorkspaceFileContributions } from "./workspace-file-contributions";
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
  id: dashboardViews.workspaces.id,
  label: "Workspaces",
  icon: dashboardViews.workspaces.icon,
  canHide: true,
  commandId: dashboardCommandIds.openWorkspaces,
  target: { kind: "view", viewId: dashboardViews.workspaces.id },
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
  registerWorkspaceFileContributions(ctx);
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

  ctx.layout.registerPanel({
    id: dashboardWidgetIds.deleteWorkspaceEntry,
    title: "Delete entry",
    region: "overlay",
    singleton: true,
    rendererId: dashboardWidgetIds.deleteWorkspaceEntry,
    config: { size: "sm", placement: "center", scrollBehavior: "inside", closeOnInteractOutside: false },
  });
  ctx.renderers.registerRenderer({
    id: dashboardWidgetIds.deleteWorkspaceEntry,
    render: (input) => <DeleteWorkspaceEntryWidget input={input} />,
  });

  ctx.layout.registerPanel(
    {
      id: dashboardWidgetIds.workspace,
      title: "Workspace",
      region: "main",
      rendererId: dashboardWidgetIds.workspace,
      singleton: true,
      resourceKinds: ["workspace"],
      subPanelsOnly: true,
    },
    { priority: 70 },
  );
  ctx.renderers.registerRenderer({
    id: dashboardWidgetIds.workspace,
    render: () => null,
  });

  ctx.layout.registerPanel(
    {
      id: dashboardWidgetIds.workspaceFiles,
      title: "Files",
      icon: "Files",
      region: "main",
      rendererId: dashboardWidgetIds.workspaceFileRenderer,
      singleton: true,
      eligibleLocations: { resourceKinds: ["workspace"] },
      panelMenus: [
        {
          id: dashboardWidgetIds.workspaceFileTree,
          title: "Files",
          icon: "Files",
          side: "left",
          rendererId: dashboardWidgetIds.workspaceFileTree,
        },
      ],
    },
    { priority: 80 },
  );
  ctx.layout.registerPanel(
    {
      id: dashboardWidgetIds.workspaceDiffs,
      title: "Changes",
      icon: "FileDiff",
      region: "main",
      rendererId: dashboardWidgetIds.workspaceDiffs,
      singleton: true,
      eligibleLocations: { resourceKinds: ["workspace"] },
    },
    { priority: 70 },
  );
  ctx.renderers.registerRenderer({
    id: dashboardWidgetIds.workspaceDiffs,
    render: (input) => <WorkspaceDiffsPanel input={input} />,
  });
};

const openWorkspaceSubPanels = (ctx: WorkbenchModuleContext, resource: ResourceRef) => {
  const ownedPanels = () =>
    ctx.layout.listPanelInstances("main").filter((panel) => panel.ownerResourceUri === resource.uri);
  let files = ownedPanels().find((panel) => panel.panelId === dashboardWidgetIds.workspaceFiles);
  let diffs = ownedPanels().find((panel) => panel.panelId === dashboardWidgetIds.workspaceDiffs);
  const firstOpen = !files && !diffs;

  files ??= ctx.layout.openPanel(dashboardWidgetIds.workspaceFiles, {
    closable: false,
    resource,
    strategy: { kind: "persistent" },
    title: "Files",
  });
  diffs ??= ctx.layout.openPanel(dashboardWidgetIds.workspaceDiffs, {
    closable: false,
    resource,
    strategy: { kind: "persistent" },
    title: "Changes",
  });

  const requestedView = metadataString(resource, "workspaceView");
  if (requestedView === "files") ctx.layout.activatePanel(files.instanceId);
  else if (requestedView === "diffs" || firstOpen) ctx.layout.activatePanel(diffs.instanceId);
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
          if (!projectId) return { type: "view", viewId: dashboardViews.workspaces.id };
          return (
            dashboardResourceParent(ctx, resource, projectId) ?? {
              type: "view",
              viewId: dashboardViews.workspaces.id,
            }
          );
        },
      });

      registerWorkspaceResourceActions(ctx);
      registerWorkspaceKanbanRenderer(ctx);
      registerWorkspaceDetailWidgets(ctx);
      watchOpenWorkspaceRename(ctx);

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
          icon: dashboardViews.workspaces.icon,
        },
        {
          execute: () => ctx.views.openView(dashboardViews.workspaces.id, { strategy: { kind: "replace-active" } }),
        },
      );

      ctx.commands.registerCommand(
        { id: dashboardCommandIds.createWorkspace, label: "New workspace", category: "Dashboard", icon: "Plus" },
        { execute: () => openCreateWorkspace(ctx) },
      );

      ctx.layout.registerMenuItem(workbenchCommandPaletteMenuPath, {
        commandId: dashboardCommandIds.openWorkspaces,
        order: 10,
      });

      registerDashboardViewRoute(ctx, {
        id: dashboardViews.workspaces.id,
        mode: "project",
        panelId: dashboardWidgetIds.workspaces,
        path: "workspaces",
        title: dashboardViews.workspaces.label,
        icon: dashboardViews.workspaces.icon,
        beforeOpen: () => {
          ctx.breadcrumbs.setItems([{ title: dashboardViews.workspaces.label, icon: dashboardViews.workspaces.icon }]);
          setDashboardSidenavSelection(ctx, dashboardViews.workspaces.id);
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
        afterOpen: ({ resource }) => {
          ensureWorkspaceTerminalResource(ctx, resource);
          openWorkspaceSubPanels(ctx, resource);
        },
      });
    },
  }) satisfies WorkbenchModuleContribution;
