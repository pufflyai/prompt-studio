import type {
  ResourceRef,
  WorkbenchModuleContribution,
  WorkbenchModuleContributionContext,
} from "pstdio-workbench/core";
import { createDashboardWorkspaces, findDashboardWorkspace } from "../../data/dashboard-data";
import { getDashboardSelectedProjectId } from "../../shared/project-context";
import { setResourceBreadcrumb } from "../../shared/resource-sync";
import { dashboardResources } from "../../shared/resources";
import { dashboardWidgetIds } from "../../shared/widget-ids";
import { openSessionBubbleWidgets } from "../sessions/session-bubble";
import { getDashboardSelectedSession } from "../sessions/session-selection";
import { registerWorkspaceDataRenderer } from "./collections/workspace-data-renderer";
import { WorkspaceChangesWidget } from "./components/workspace-changes-widget";
import { WorkspaceChecksWidget } from "./components/workspace-checks-widget";
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
const setupWorkspaceChrome = (modeCtx: WorkbenchModuleContributionContext) => {
  modeCtx.layout.clearArea("left");
  modeCtx.layout.openWidget(dashboardWidgetIds.workspaceSidebar, { pinned: true });
  modeCtx.renderers.refresh(dashboardWidgetIds.workspaceSidebar);
  const selectedSession = getDashboardSelectedSession(modeCtx);
  openSessionBubbleWidgets(
    modeCtx,
    selectedSession ? { resource: selectedSession.resource, title: selectedSession.title } : {},
  );
  return undefined;
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
      registerWorkspaceDataRenderer(ctx);
      registerWorkspaceWidgets(ctx);
      registerWorkspaceSidebarTree(ctx);

      ctx.modes.registerMode({ id: "project", label: "Project", activate: setupWorkspaceChrome });
      ctx.modes.registerMode({ id: "workspace", label: "Workspace", activate: setupWorkspaceChrome });

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
          if (session) {
            openSessionBubbleWidgets(ctx, { resource: session.resource, title: session.title });
            if (workspaceSession) syncWorkspaceSidebarSessionSelection(ctx, session.resource);
          }

          return openWorkspaceWidgets(ctx, resource);
        },
      });
    },
  }) satisfies WorkbenchModuleContribution;
