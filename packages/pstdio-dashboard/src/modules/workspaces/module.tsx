import { workbenchPages } from "@pstdio/sdk/extensions";
import type { TreeNode, WorkbenchModuleContext, WorkbenchModuleContribution } from "@pstdio/workbench";
import { workbenchCommandPaletteMenuPath } from "@pstdio/workbench";
import { dashboardCommandIds } from "@/shared/app/commands";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import { dashboardViews } from "@/shared/app/resources";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { registerDashboardNavigationContribution } from "@/shared/workbench/dashboard-navigation-contribution";
import { updateDashboardSidenav } from "@/shared/workbench/dashboard-sidenav";
import { openWorkspacesPage } from "@/shared/workbench/page-navigation";
import { dashboardResourceParent } from "@/shared/workbench/resource-hierarchy";
import { registerWorkspaceDataTableView } from "./collections/workspace-data-table-renderer";
import { CreateWorkspaceWidget } from "./components/create-workspace-widget";
import { DeleteWorkspaceEntryWidget } from "./components/delete-workspace-entry-widget";
import { RenameWorkspaceWidget } from "./components/rename-workspace-widget";
import { WorkspaceDiffsPanel } from "./components/workspace-widget";
import { createDashboardWorkspaces } from "./data/dashboard-workspaces";
import { resourceMetadataString } from "./resource-metadata";
import { registerWorkspaceFileContributions } from "./workspace-file-contributions";
import { ensureWorkspaceTerminalResource, registerWorkspaceResourceActions } from "./workspace-resource-actions";
import { watchOpenWorkspaceResource } from "./workspace-resource-sync";

const openCreateWorkspace = (ctx: WorkbenchModuleContext) => {
  const projectId = getDashboardSelectedProjectId(ctx);
  if (!projectId) {
    ctx.pageLocations.clearProject();
    ctx.modes.setActiveMode("project-selection");
    return;
  }

  return ctx.overlays.openOverlay(dashboardWidgetIds.createWorkspace, { title: "Create workspace" });
};

const workspaceNavigationNode = (): TreeNode => ({
  id: dashboardViews.workspaces.id,
  label: "Workspaces",
  icon: dashboardViews.workspaces.icon,
  canHide: true,
  hiddenByDefault: true,
  commandId: dashboardCommandIds.openWorkspaces,
  target: { kind: "page", page: workbenchPages.workspaces },
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
  registerDashboardNavigationContribution(ctx, {
    id: "dashboard.workspaces.project-nav",
    modes: ["project"],
    getSections: () => [{ id: "navigation.root", nodes: [workspaceNavigationNode()] }],
  });
};

const registerWorkspaceDetailWidgets = (ctx: WorkbenchModuleContext) => {
  registerWorkspaceFileContributions(ctx);
  ctx.views.registerView({
    id: dashboardWidgetIds.createWorkspace,
    title: "Create workspace",
    body: {
      kind: "react",
      render: (input) => <CreateWorkspaceWidget input={input} />,
    },
  });
  ctx.overlays.registerOverlay({
    id: dashboardWidgetIds.createWorkspace,
    viewId: dashboardWidgetIds.createWorkspace,
    config: { size: "sm", placement: "center", scrollBehavior: "inside", closeOnInteractOutside: false },
  });

  ctx.views.registerView({
    id: dashboardWidgetIds.renameWorkspace,
    title: "Rename workspace",
    body: {
      kind: "react",
      render: (input) => <RenameWorkspaceWidget input={input} />,
    },
  });
  ctx.overlays.registerOverlay({
    id: dashboardWidgetIds.renameWorkspace,
    viewId: dashboardWidgetIds.renameWorkspace,
    config: { size: "sm", placement: "center", scrollBehavior: "inside", closeOnInteractOutside: false },
  });

  ctx.views.registerView({
    id: dashboardWidgetIds.deleteWorkspaceEntry,
    title: "Delete entry",
    body: {
      kind: "react",
      render: (input) => <DeleteWorkspaceEntryWidget input={input} />,
    },
  });
  ctx.overlays.registerOverlay({
    id: dashboardWidgetIds.deleteWorkspaceEntry,
    viewId: dashboardWidgetIds.deleteWorkspaceEntry,
    config: { size: "sm", placement: "center", scrollBehavior: "inside", closeOnInteractOutside: false },
  });

  ctx.viewMenus.registerViewMenu({
    id: dashboardWidgetIds.workspaceFileTree,
    ownerViewId: dashboardWidgetIds.workspaceFiles,
    viewId: dashboardWidgetIds.workspaceFileTree,
    side: "left",
  });
  ctx.views.registerView(
    {
      id: dashboardWidgetIds.workspaceDiffs,
      title: "Changes",
      icon: "FileDiff",
      body: { kind: "react", render: (input) => <WorkspaceDiffsPanel input={input} /> },
    },
    { priority: 70 },
  );
};

const registerWorkspacesPage = (ctx: WorkbenchModuleContext) => {
  ctx.pages.registerPage({
    id: dashboardViews.workspaces.id,
    ref: workbenchPages.workspaces,
    title: dashboardViews.workspaces.label,
    icon: dashboardViews.workspaces.icon,
    path: "workspaces",
    modeId: "project",
    slots: [{ id: "content", role: "primary", region: "main", viewId: dashboardWidgetIds.workspaces }],
  });
  return ctx.pages.registerPage({
    id: workbenchPages.workspace.id,
    ref: workbenchPages.workspace,
    title: "Workspace",
    icon: dashboardViews.workspaces.icon,
    path: "workspace",
    modeId: "project",
    parentId: dashboardViews.workspaces.id,
    slots: [
      {
        id: "content",
        role: "primary",
        region: "main",
        binding: { resourceKinds: ["workspace"], viewId: dashboardWidgetIds.workspaceDiffs, cardinality: "many" },
      },
      {
        id: "files",
        role: "auxiliary",
        region: "main",
        binding: { resourceKinds: ["workspace"], viewId: dashboardWidgetIds.workspaceFiles, cardinality: "one" },
        openOn: "page-resource",
      },
    ],
  });
};

const syncActiveWorkspacePage = (ctx: WorkbenchModuleContext) => {
  const state = ctx.pages.store.getState();
  if (state.activePageId !== workbenchPages.workspace.id || state.location?.resource?.type !== "workspace") return;
  const resource = ctx.getPrimaryResource();
  if (!resource) return;
  ensureWorkspaceTerminalResource(ctx, resource);
  updateDashboardSidenav(ctx, { selectedNode: null });
  if (resourceMetadataString(resource, "workspaceView") !== "files") return;
  const files = ctx.layout
    .listPanelInstances("main")
    .find((panel) => panel.viewId === dashboardWidgetIds.workspaceFiles && panel.resourceUri === resource.uri);
  if (files) ctx.layout.activatePanel(files.instanceId);
};

// The workspaces slice owns the project navigation shell, the workspaces board,
// and the workspace panels used when a workspace resource opens.
export const createWorkspacesModule = () =>
  ({
    id: "dashboard.workspaces",
    activate(ctx) {
      ctx.resources.registerKind({
        kind: "workspace",
        label: "Workspace",
        icon: "GitBranch",
      });

      ctx.resources.registerProvider({
        id: "dashboard-workbench.workspaces",
        kind: "workspace",
        list: () =>
          createDashboardWorkspaces(getDashboardSelectedProjectId(ctx)).map((workspace) => ({
            resource: workspace.resource,
            searchText: [workspace.title, workspace.shorthand, workspace.branch].filter(Boolean).join(" "),
            group: "Workspaces",
            activate: () => openWorkspacesPage(ctx, workspace.resource),
          })),
      });
      ctx.resources.registerHierarchyProvider({
        id: "dashboard-workbench.workspace-hierarchy",
        priority: 100,
        canResolve: (resource) => resource.kind === "workspace",
        getParent: (resource) => {
          const projectId = resourceMetadataString(resource, "projectId") ?? getDashboardSelectedProjectId(ctx);
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
      registerWorkspaceDataTableView(ctx);
      registerWorkspaceDetailWidgets(ctx);
      registerWorkspacesPage(ctx);
      const workspaceResourceSubscription = watchOpenWorkspaceResource(ctx);

      registerWorkspaceSidenavContributions(ctx);

      ctx.modes.registerMode({
        id: "project",
        label: "Project",
        panels: ["main", "secondary", "side"],
        activate: () => undefined,
      });

      ctx.commands.registerCommand(
        {
          id: dashboardCommandIds.openWorkspaces,
          label: "Open workspaces",
          category: "Dashboard",
          icon: dashboardViews.workspaces.icon,
        },
        {
          execute: () => openWorkspacesPage(ctx),
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

      const unsubscribePage = ctx.pages.store.subscribe(() => syncActiveWorkspacePage(ctx));
      const primaryResourceSubscription = ctx.onDidChangePrimaryResource(() => syncActiveWorkspacePage(ctx));
      return {
        dispose: () => {
          workspaceResourceSubscription.dispose();
          unsubscribePage();
          primaryResourceSubscription.dispose();
        },
      };
    },
  }) satisfies WorkbenchModuleContribution;
