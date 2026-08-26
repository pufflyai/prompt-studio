import { standardResourceIcons, type WorkbenchModuleContext, type WorkbenchModuleContribution } from "../../../../core";
import { dashboardViews } from "../../shared/mock-data/resources";
import { dashboardWidgetIds } from "../../shared/widget-ids";
import { registerCommands, registerMenus } from "./commands";
import { DashboardSidenavHeader } from "./components/dashboard-sidenav-header";
import { ExtensionViewWidget } from "./components/extension-view-widget";
import { StatusWidget } from "./components/status-widget";
import { registerProjectNavigation } from "./project-nav";

const SIDENAV_HEADER_WIDGET_ID = "dashboard.sidenavHeader";

const dashboardResourceKinds = [
  { kind: "project", label: "Project", icon: standardResourceIcons.project },
  { kind: "ticket", label: "Ticket", icon: "component" },
  { kind: "workspace", label: "Workspace", icon: standardResourceIcons.workspace },
] as const;

const registerChrome = (ctx: WorkbenchModuleContext) => {
  ctx.layout.registerPanel({
    id: SIDENAV_HEADER_WIDGET_ID,
    title: "Project brand",
    region: "sidenav-header",
    singleton: true,
    rendererId: SIDENAV_HEADER_WIDGET_ID,
  });
  ctx.renderers.registerRenderer({
    id: SIDENAV_HEADER_WIDGET_ID,
    render: (input) => <DashboardSidenavHeader workbench={input.workbench} />,
  });

  ctx.layout.registerPanel({
    id: dashboardWidgetIds.status,
    title: "Dashboard status",
    region: "main",
    singleton: true,
    rendererId: dashboardWidgetIds.status,
  });
  ctx.renderers.registerRenderer({
    id: dashboardWidgetIds.status,
    render: (input) => <StatusWidget input={input} />,
  });
  ctx.views.registerView({
    id: dashboardWidgetIds.status,
    panelId: dashboardWidgetIds.status,
    title: "Dashboard status",
  });
  ctx.statusBar.registerItem({
    id: `${dashboardWidgetIds.status}.item`,
    viewId: dashboardWidgetIds.status,
    slot: "leading",
  });

  ctx.layout.registerPanel(
    {
      id: dashboardWidgetIds.extensionPage,
      title: "Extension page",
      region: "main",
      singleton: true,
      rendererId: dashboardWidgetIds.extensionPage,
      priority: 70,
    },
    { priority: 70 },
  );
  ctx.renderers.registerRenderer({
    id: dashboardWidgetIds.extensionPage,
    render: (input) => <ExtensionViewWidget input={input} />,
  });

  ctx.layout.openPanel(SIDENAV_HEADER_WIDGET_ID, { pinned: true });
};

// The shell slice: the project brand and status bar, the global
// command palette, the project navigation mode, and extension views.
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

    for (const view of [dashboardViews.lab, dashboardViews.repoHealth, dashboardViews.changelog]) {
      ctx.views.registerView({
        id: view.id,
        panelId: dashboardWidgetIds.extensionPage,
        title: view.label,
        icon: view.icon,
        resolveInput: (input) => {
          ctx.modes.setActiveMode("project");
          ctx.breadcrumbs.setItems([{ title: view.label, icon: view.icon }]);
          return input;
        },
      });
    }
  },
});
