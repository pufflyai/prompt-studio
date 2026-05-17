import type { WorkbenchModuleContributionContext } from "../../../core";
import { dashboardWidgetIds } from "../mock-data/data";
import { DashboardLeftHeader } from "./dashboard-left-header";
import { DashboardMainHeader } from "./dashboard-main-header";
import { ExtensionRouteWidget, SettingsWidget, StatusWidget } from "./misc-widgets";
import { SessionWidget } from "./session-widget";
import { TicketsWidget } from "./tickets-widget";
import { WorkspaceWidget } from "./workspace-widget";
import {
  SessionsOverviewWidget,
  WorkspaceListWidget,
  WorkspacePageWidget,
  WorkspacesOverviewWidget,
} from "./workspaces-widget";

export { DashboardLeftHeader };

export const registerDashboardWorkbenchRenderers = (ctx: WorkbenchModuleContributionContext) => {
  ctx.renderers.registerRenderer({
    id: dashboardWidgetIds.header,
    render: (input) => <DashboardMainHeader input={input} />,
  });
  ctx.renderers.registerRenderer({
    id: dashboardWidgetIds.tickets,
    render: (input) => <TicketsWidget input={input} />,
  });
  ctx.renderers.registerRenderer({
    id: dashboardWidgetIds.workspaces,
    render: () => <WorkspacesOverviewWidget />,
  });
  ctx.renderers.registerRenderer({
    id: dashboardWidgetIds.workspace,
    render: (input) => <WorkspaceWidget input={input} />,
  });
  ctx.renderers.registerRenderer({
    id: dashboardWidgetIds.workspacePage,
    render: () => <WorkspacePageWidget />,
  });
  ctx.renderers.registerRenderer({
    id: dashboardWidgetIds.workspaceList,
    render: (input) => <WorkspaceListWidget input={input} />,
  });
  ctx.renderers.registerRenderer({
    id: dashboardWidgetIds.sessions,
    render: (input) => <SessionsOverviewWidget input={input} />,
  });
  ctx.renderers.registerRenderer({
    id: dashboardWidgetIds.extensionRoute,
    render: (input) => <ExtensionRouteWidget input={input} />,
  });
  ctx.renderers.registerRenderer({
    id: dashboardWidgetIds.settings,
    render: (input) => <SettingsWidget input={input} />,
  });
  ctx.renderers.registerRenderer({
    id: dashboardWidgetIds.status,
    render: (input) => <StatusWidget input={input} />,
  });
  ctx.renderers.registerRenderer({
    id: dashboardWidgetIds.session,
    render: (input) => <SessionWidget input={input} />,
  });
};
