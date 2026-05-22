import type {
  ResourceRef,
  WorkbenchModuleContribution,
  WorkbenchModuleContributionContext,
} from "pstdio-workbench/core";
import { createDashboardWorkspaces, findDashboardWorkspace } from "../../data/dashboard-data";
import { setResourceBreadcrumb } from "../../shared/resource-sync";
import { dashboardResources } from "../../shared/resources";
import { dashboardWidgetIds } from "../../shared/widget-ids";
import { openSessionBubbleWidgets } from "../sessions/session-bubble";
import { registerWorkspaceDataRenderer } from "./collections/workspace-data-renderer";
import { WorkspaceChangesWidget } from "./components/workspace-changes-widget";
import { WorkspaceChecksWidget } from "./components/workspace-checks-widget";
import { registerWorkspaceSidebarTree, syncWorkspaceSidebar } from "./workspace-sidebar-tree";

const setDetailBreadcrumbs = (ctx: WorkbenchModuleContributionContext, resource: ResourceRef) => {
  const workspace = findDashboardWorkspace(resource);

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
  ctx.renderers.registerRenderer({ id: dashboardWidgetIds.workspaceChanges, render: () => <WorkspaceChangesWidget /> });

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
  ctx.renderers.registerRenderer({ id: dashboardWidgetIds.workspaceChecks, render: () => <WorkspaceChecksWidget /> });
};

// The project and workspace modes share the workspace list sidebar and the
// floating session bubble; only their main-area widgets differ. The sidebar is
// refreshed so its body reflects the mode that just activated.
const setupWorkspaceChrome = (modeCtx: WorkbenchModuleContributionContext) => {
  modeCtx.layout.clearArea("left");
  modeCtx.layout.openWidget(dashboardWidgetIds.workspaceSidebar, { pinned: true });
  modeCtx.renderers.refresh(dashboardWidgetIds.workspaceSidebar);
  openSessionBubbleWidgets(modeCtx);
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
        list: () => createDashboardWorkspaces().map(({ resource }) => ({ resource, group: "Workspaces" })),
      });

      ctx.resources.registerOpener({
        id: "dashboard.workspaces.opener",
        priority: 1000,
        canOpen: (resource) =>
          (resource.kind === "dashboard-view" && resource.id === "workspaces") || resource.kind === "workspace",
        open: (resource, input) => {
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

          // Load the workspace's first session into the bubble so the chat and
          // selector start populated; the sidebar and dropdown then switch it.
          const [firstSession] = findDashboardWorkspace(resource)?.sessions ?? [];
          if (firstSession) {
            openSessionBubbleWidgets(ctx, { resource: firstSession.resource, title: firstSession.title });
          }

          return openWorkspaceWidgets(ctx, resource);
        },
      });
    },
  }) satisfies WorkbenchModuleContribution;
