import type {
  ResourceRef,
  WorkbenchModuleContribution,
  WorkbenchModuleContributionContext,
} from "pstdio-workbench/core";
import { workbenchCommandPaletteMenuPath } from "pstdio-workbench/core";
import { dashboardCommandIds } from "@/shared/app/commands";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import { dashboardResources } from "@/shared/app/resources";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { subscribeDashboardData } from "@/shared/sync/dashboard-rows";
import { registerDashboardViewContribution } from "@/shared/workbench/contributions/dashboard-view-contributions";
import { activateModeChromeContributions } from "@/shared/workbench/contributions/mode-chrome-contributions";
import { setResourceBreadcrumb } from "@/shared/workbench/resource-sync";
import { registerResourceRoute } from "@/shared/workbench/route-helper";
import { createDashboardSessions } from "../sessions/data/dashboard-sessions";
import { registerWorkspaceDataRenderer } from "./collections/workspace-data-renderer";
import { CreateWorkspaceWidget } from "./components/create-workspace-widget";
import { RenameWorkspaceWidget } from "./components/rename-workspace-widget";
import { WorkspaceWidget } from "./components/workspace-widget";
import { createDashboardWorkspaces } from "./data/dashboard-workspaces";
import { setWorkspaceBreadcrumb } from "./workspace-breadcrumb";
import { registerWorkspaceResourceActions } from "./workspace-resource-actions";
import {
  registerProjectSidebarTree,
  registerWorkspaceSidebarTree,
  syncWorkspaceSidebar,
} from "./workspace-sidebar-tree";

const openCreateWorkspace = (ctx: WorkbenchModuleContributionContext) => {
  const projectId = getDashboardSelectedProjectId(ctx);
  if (!projectId) {
    ctx.modes.setActiveMode("project-selection");
    return;
  }

  return ctx.layout.openWidget(dashboardWidgetIds.createWorkspace, { title: "Create workspace" });
};

// The project mode owns the left sidebar: it clears the area, pins the project
// tree, and activates any mode chrome (e.g. the session bubble). Sessions and
// settings modes swap it out, and "Back to project" reactivates it.
const setupProjectSidebarChrome = (modeCtx: WorkbenchModuleContributionContext) => {
  modeCtx.layout.clearArea("left");
  modeCtx.layout.openWidget(dashboardWidgetIds.projectSidebar, { pinned: true });
  modeCtx.renderers.refresh(dashboardWidgetIds.projectSidebar);
  return activateModeChromeContributions(modeCtx, "project");
};

const setupWorkspaceSidebarChrome = (modeCtx: WorkbenchModuleContributionContext) => {
  modeCtx.layout.clearArea("floating");
  modeCtx.layout.clearArea("floating-header");
  modeCtx.layout.clearArea("left");
  // The workspace detail owns the main-right projection; clearing on mode entry (rather than
  // per open) keeps it as mode chrome so history replay restores it via setActiveMode.
  modeCtx.layout.clearArea("main-right");
  modeCtx.layout.openWidget(dashboardWidgetIds.workspaceSidebar, { pinned: true });
  modeCtx.renderers.refresh(dashboardWidgetIds.workspaceSidebar);
  return activateModeChromeContributions(modeCtx, "workspace");
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
  if (!ctx.commands.getCommand(dashboardCommandIds.openFloatingSession)) return;

  const session = findFirstWorkspaceSessionResource(ctx, resource);
  if (!session) return;

  void ctx.commands.executeCommand(dashboardCommandIds.openFloatingSession, { resource: session });
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
    area: "overlay",
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
    area: "overlay",
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
      area: "main",
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
      ctx.resources.registerKind({ kind: "workspace", label: "Workspace", icon: "GitBranch" });

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

      registerProjectSidebarTree(ctx);
      registerWorkspaceSidebarTree(ctx);

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
          ctx.renderers.setSelectedNode(dashboardWidgetIds.projectSidebar, resource.uri);
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
          syncWorkspaceSidebar(ctx, resource);
          openFirstWorkspaceSession(ctx, resource);
        },
      });
    },
  }) satisfies WorkbenchModuleContribution;
