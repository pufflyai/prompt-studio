import {
  standardResourceIcons,
  type WorkbenchModuleContribution,
  type WorkbenchModuleContributionContext,
} from "../../../../core";
import { dashboardResources } from "../../shared/mock-data/resources";
import { setResourceBreadcrumb } from "../../shared/resource-sync";
import { dashboardWidgetIds } from "../../shared/widget-ids";
import { registerCommands, registerMenus } from "./commands";
import { DashboardMainHeader } from "./components/dashboard-main-header";
import { DashboardSidebarHeader } from "./components/dashboard-sidebar-header";
import { ExtensionRouteWidget } from "./components/extension-route-widget";
import { StatusWidget } from "./components/status-widget";
import { registerProjectNavigation } from "./project-nav";

const SIDEBAR_HEADER_WIDGET_ID = "dashboard.sidebarHeader";

const dashboardResourceKinds = [
  { kind: "project", label: "Project", icon: standardResourceIcons.project },
  { kind: "dashboard-view", label: "Dashboard view", icon: "square-kanban" },
  { kind: "ticket", label: "Ticket", icon: "component" },
  { kind: "workspace", label: "Workspace", icon: standardResourceIcons.workspace },
  { kind: "extension-route", label: "Extension route", icon: "PanelLeft" },
] as const;

const registerChrome = (ctx: WorkbenchModuleContributionContext) => {
  ctx.layout.registerWidget(
    {
      id: dashboardWidgetIds.header,
      title: "Dashboard header",
      region: "nav",
      singleton: true,
      rendererId: dashboardWidgetIds.header,
      priority: 100,
    },
    { priority: 100 },
  );
  ctx.renderers.registerRenderer({
    id: dashboardWidgetIds.header,
    render: (input) => <DashboardMainHeader input={input} />,
  });

  ctx.layout.registerWidget({
    id: SIDEBAR_HEADER_WIDGET_ID,
    title: "Project brand",
    region: "sidebar-header",
    singleton: true,
    rendererId: SIDEBAR_HEADER_WIDGET_ID,
  });
  ctx.renderers.registerRenderer({
    id: SIDEBAR_HEADER_WIDGET_ID,
    render: (input) => <DashboardSidebarHeader workbench={input.workbench} />,
  });

  ctx.layout.registerWidget(
    {
      id: dashboardWidgetIds.status,
      title: "Dashboard status",
      region: "status",
      singleton: true,
      rendererId: dashboardWidgetIds.status,
      priority: 50,
    },
    { priority: 50 },
  );
  ctx.renderers.registerRenderer({
    id: dashboardWidgetIds.status,
    render: (input) => <StatusWidget input={input} />,
  });

  ctx.layout.registerWidget(
    {
      id: dashboardWidgetIds.extensionRoute,
      title: "Extension route",
      region: "main",
      singleton: true,
      rendererId: dashboardWidgetIds.extensionRoute,
      priority: 70,
    },
    { priority: 70 },
  );
  ctx.renderers.registerRenderer({
    id: dashboardWidgetIds.extensionRoute,
    render: (input) => <ExtensionRouteWidget input={input} />,
  });

  ctx.layout.openWidget(dashboardWidgetIds.header, { pinned: true });
  ctx.layout.openWidget(SIDEBAR_HEADER_WIDGET_ID, { pinned: true });
  ctx.layout.openWidget(dashboardWidgetIds.status, { pinned: true });
};

// The shell slice: the workbench chrome (header, brand, status bar), the global
// command palette, the project navigation mode, and extension-route surfaces.
export const createShellModule = (): WorkbenchModuleContribution => ({
  id: "dashboard.shell",
  activate(ctx) {
    for (const kind of dashboardResourceKinds) ctx.resources.registerKind(kind);

    registerChrome(ctx);
    registerCommands(ctx);
    registerMenus(ctx);

    ctx.modes.registerMode({
      id: "project",
      label: "Project",
      activate(modeCtx) {
        registerProjectNavigation(modeCtx);
        return undefined;
      },
    });

    ctx.resources.registerProvider({
      id: "dashboard-workbench.dashboard-views",
      kind: "dashboard-view",
      list: () => [
        { resource: dashboardResources.tickets, group: "Dashboard" },
        { resource: dashboardResources.workspaces, group: "Dashboard" },
        { resource: dashboardResources.sessions, group: "Dashboard" },
      ],
    });

    ctx.resources.registerProvider({
      id: "dashboard-workbench.extension-routes",
      kind: "extension-route",
      list: () => [
        { resource: dashboardResources.lab, group: "Extensions" },
        { resource: dashboardResources.repoHealth, group: "Extensions" },
        { resource: dashboardResources.changelog, group: "Extensions" },
      ],
    });

    ctx.resources.registerOpener({
      id: "dashboard.shell.extension-route-opener",
      priority: 1000,
      canOpen: (resource) => resource.kind === "extension-route",
      open: (resource, input) => {
        ctx.modes.setActiveMode("project");
        setResourceBreadcrumb(ctx, resource);
        return ctx.layout.openWidget(dashboardWidgetIds.extensionRoute, {
          resource,
          title: resource.label,
          replaceActive: input.replaceActive,
        });
      },
    });
  },
});
