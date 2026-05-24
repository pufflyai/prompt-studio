import type {
  ResourceRef,
  WorkbenchModuleContribution,
  WorkbenchModuleContributionContext,
} from "pstdio-workbench/core";
import { workbenchCommandPaletteMenuPath } from "pstdio-workbench/core";
import { dashboardCommandIds } from "../../shared/commands";
import { registerDashboardViewContribution } from "../../shared/dashboard-view-contributions";
import { registerMainHeaderContribution } from "../../shared/header-contributions";
import { dashboardWorkspaceMenuPath } from "../../shared/menu-paths";
import { activateModeChromeContributions } from "../../shared/mode-chrome-contributions";
import { getDashboardSelectedProjectId } from "../../shared/project-context";
import { setResourceBreadcrumb } from "../../shared/resource-sync";
import { dashboardResources } from "../../shared/resources";
import { getDashboardSelectedSession } from "../../shared/session/session-selection";
import { dashboardWidgetIds } from "../../shared/widget-ids";
import { registerWorkspaceDataRenderer } from "./collections/workspace-data-renderer";
import { WorkspaceChangesWidget } from "./components/workspace-changes-widget";
import { WorkspaceChecksWidget } from "./components/workspace-checks-widget";
import { isWorkspaceHeaderPlacement, WorkspaceHeaderControls } from "./components/workspace-header-controls";
import { createDashboardWorkspaces, findDashboardWorkspace } from "./data/dashboard-workspaces";
import {
  registerWorkspaceSidebarTree,
  syncWorkspaceSidebar,
  syncWorkspaceSidebarSessionSelection,
} from "./workspace-sidebar-tree";

const setDetailBreadcrumbs = (ctx: WorkbenchModuleContributionContext, resource: ResourceRef) => {
  const workspace = findDashboardWorkspace(resource, getDashboardSelectedProjectId(ctx));

  ctx.breadcrumbs.setItems([
    {
      title: "Workspaces",
      icon: "GitBranch",
      resource: dashboardResources.workspaces,
      onClick: () => void ctx.resources.openResource(dashboardResources.workspaces, { replaceActive: true }),
    },
    { title: workspace?.shorthand ?? resource.label, icon: "GitBranch", resource },
  ]);
};

const registerWorkspaceWidgets = (ctx: WorkbenchModuleContributionContext) => {
  ctx.layout.registerWidget(
    {
      id: dashboardWidgetIds.workspaceChanges,
      title: "Changes",
      area: "main",
      singleton: true,
      rendererId: dashboardWidgetIds.workspaceChanges,
      priority: 80,
    },
    { priority: 80 },
  );
  ctx.renderers.registerRenderer({
    id: dashboardWidgetIds.workspaceChanges,
    render: (input) => <WorkspaceChangesWidget input={input} />,
  });

  ctx.layout.registerWidget(
    {
      id: dashboardWidgetIds.workspaceChecks,
      title: "Checks",
      area: "main",
      singleton: true,
      rendererId: dashboardWidgetIds.workspaceChecks,
      priority: 79,
    },
    { priority: 79 },
  );
  ctx.renderers.registerRenderer({
    id: dashboardWidgetIds.workspaceChecks,
    render: (input) => <WorkspaceChecksWidget input={input} />,
  });
};

// The project and workspace modes share the workspace list sidebar and the
// floating session bubble; only their main-area widgets differ. The sidebar is
// refreshed so its body reflects the mode that just activated.
const setupWorkspaceChrome = (modeId: string) => (modeCtx: WorkbenchModuleContributionContext) => {
  modeCtx.layout.clearArea("left");
  modeCtx.layout.openWidget(dashboardWidgetIds.workspaceSidebar, { pinned: true });
  modeCtx.renderers.refresh(dashboardWidgetIds.workspaceSidebar);
  return activateModeChromeContributions(modeCtx, modeId);
};

const openWorkspaceWidgets = (ctx: WorkbenchModuleContributionContext, resource: ResourceRef) => {
  const changes = ctx.layout.openWidget(dashboardWidgetIds.workspaceChanges, { resource, title: "Changes" });
  ctx.layout.openWidget(dashboardWidgetIds.workspaceChecks, { resource, title: "Checks" });
  ctx.layout.activateWidget(changes.widgetId);

  return changes;
};

// The workspaces slice owns two modes that share the workspace sidebar: `project`
// shows the workspaces board, `workspace` shows one workspace's review widgets.
// Switching modes tears down the previous mode's main-area widgets, so returning
// to the board never leaves stale detail tabs behind.
export const createWorkspacesModule = () =>
  ({
    id: "dashboard.workspaces",
    activate(ctx) {
      ctx.resources.registerKind({ kind: "workspace", label: "Workspace", icon: "GitBranch" });
      registerDashboardViewContribution(ctx, {
        resource: dashboardResources.workspaces,
        group: "Dashboard",
        order: 10,
      });
      registerWorkspaceDataRenderer(ctx);
      registerWorkspaceWidgets(ctx);
      registerWorkspaceSidebarTree(ctx);
      registerMainHeaderContribution(ctx, {
        id: "dashboard.workspaces.header-controls",
        canRender: isWorkspaceHeaderPlacement,
        render: (input, placement) => <WorkspaceHeaderControls input={input} placement={placement} />,
      });

      ctx.modes.registerMode({ id: "project", label: "Project", activate: setupWorkspaceChrome("project") });
      ctx.modes.registerMode({ id: "workspace", label: "Workspace", activate: setupWorkspaceChrome("workspace") });
      ctx.commands.registerCommand(
        { id: dashboardCommandIds.openWorkspaces, label: "Open workspaces", category: "Dashboard", icon: "GitBranch" },
        { execute: () => ctx.resources.openResource(dashboardResources.workspaces, { replaceActive: true }) },
      );
      ctx.commands.registerCommand(
        {
          id: dashboardCommandIds.openCurrentWorkspace,
          label: "Open current workspace",
          category: "Dashboard",
          icon: "GitBranch",
        },
        {
          execute: () => {
            const projectId = getDashboardSelectedProjectId(ctx);
            if (!projectId) {
              ctx.modes.setActiveMode("project-selection");
              return undefined;
            }

            const [workspace] = createDashboardWorkspaces(projectId);
            if (!workspace) {
              ctx.notifications.show({ level: "info", title: "No workspace available" });
              return undefined;
            }

            return ctx.resources.openResource(workspace.resource, { replaceActive: true });
          },
        },
      );
      ctx.commands.registerCommand(
        { id: dashboardCommandIds.createWorkspace, label: "Add manual workspace", category: "Dashboard", icon: "Plus" },
        { execute: () => ctx.notifications.show({ level: "info", title: "Manual workspace creation queued" }) },
      );
      ctx.commands.registerCommand(
        { id: dashboardCommandIds.deleteWorkspace, label: "Delete workspace", category: "Dashboard", icon: "Trash2" },
        { execute: () => ctx.notifications.show({ level: "warning", title: "Workspace deletion queued" }) },
      );
      ctx.commands.registerCommand(
        {
          id: dashboardCommandIds.selectWorkspaceSidebarSession,
          label: "Select workspace sidebar session",
          category: "Dashboard",
        },
        {
          execute: (args) => {
            const { resource } = (args ?? {}) as { resource?: ResourceRef };
            if (resource) syncWorkspaceSidebarSessionSelection(ctx, resource);
          },
        },
      );
      ctx.layout.registerMenuItem(workbenchCommandPaletteMenuPath, {
        commandId: dashboardCommandIds.openWorkspaces,
        order: 10,
      });
      ctx.layout.registerMenuItem(workbenchCommandPaletteMenuPath, {
        commandId: dashboardCommandIds.openCurrentWorkspace,
        order: 20,
      });
      ctx.layout.registerMenuItem(dashboardWorkspaceMenuPath, {
        commandId: dashboardCommandIds.deleteWorkspace,
        group: "overflow",
        overflowLabel: "Workspace actions",
        order: 10,
      });

      ctx.resources.registerProvider({
        id: "dashboard-workbench.workspaces",
        kind: "workspace",
        list: () =>
          createDashboardWorkspaces(getDashboardSelectedProjectId(ctx)).map(({ resource }) => ({
            resource,
            group: "Workspaces",
          })),
      });

      ctx.resources.registerOpener({
        id: "dashboard.workspaces.opener",
        priority: 1000,
        canOpen: (resource) =>
          (resource.kind === "dashboard-view" && resource.id === "workspaces") || resource.kind === "workspace",
        open: (resource, input) => {
          if (!getDashboardSelectedProjectId(ctx)) {
            ctx.modes.setActiveMode("project-selection");
            return undefined;
          }

          if (resource.kind === "dashboard-view") {
            ctx.modes.setActiveMode("project");
            setResourceBreadcrumb(ctx, resource);
            ctx.renderers.setSelectedNode(dashboardWidgetIds.workspaceSidebar, resource.uri);
            return ctx.layout.openWidget(dashboardWidgetIds.workspaces, {
              resource,
              title: resource.label,
              replaceActive: input.replaceActive,
            });
          }

          ctx.modes.setActiveMode("workspace");
          syncWorkspaceSidebar(ctx, resource);
          setDetailBreadcrumbs(ctx, resource);

          const workspace = findDashboardWorkspace(resource, getDashboardSelectedProjectId(ctx));
          const selectedSession = getDashboardSelectedSession(ctx);
          const workspaceSession = workspace?.sessions.find((session) => session.id === selectedSession?.id);
          const session = workspaceSession ?? workspace?.sessions[0];
          if (session && ctx.commands.getCommand(dashboardCommandIds.openFloatingSession)) {
            void ctx.commands.executeCommand(dashboardCommandIds.openFloatingSession, {
              resource: session.resource,
              selectWorkspaceSidebar: Boolean(workspaceSession),
            });
          }

          return openWorkspaceWidgets(ctx, resource);
        },
      });
    },
  }) satisfies WorkbenchModuleContribution;
