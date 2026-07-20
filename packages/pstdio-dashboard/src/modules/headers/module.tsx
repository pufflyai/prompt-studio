import type { WorkbenchModuleContribution, WorkbenchModuleContributionContext } from "@pstdio/workbench/core";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { renderSidebarHeaderContribution } from "@/shared/workbench/contributions/header-contributions";
import { DashboardMainHeader } from "./components/dashboard-headers";

const registerHeaders = (ctx: WorkbenchModuleContributionContext) => {
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
    id: dashboardWidgetIds.sidebarHeader,
    title: "Project brand",
    region: "sidebar-header",
    singleton: true,
    rendererId: dashboardWidgetIds.sidebarHeader,
    headerBorderBottom: false,
  });

  ctx.renderers.registerRenderer({
    id: dashboardWidgetIds.sidebarHeader,
    render: renderSidebarHeaderContribution,
  });

  ctx.layout.openWidget(dashboardWidgetIds.header, { pinned: true });
  ctx.layout.openWidget(dashboardWidgetIds.sidebarHeader, { pinned: true });
};

export const createHeadersModule = () =>
  ({
    id: "dashboard.headers",
    activate(ctx) {
      registerHeaders(ctx);
    },
  }) satisfies WorkbenchModuleContribution;
