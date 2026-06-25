import type { WorkbenchModuleContribution, WorkbenchModuleContributionContext } from "pstdio-workbench/core";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { renderLeftHeaderContribution } from "@/shared/workbench/contributions/header-contributions";
import { DashboardMainHeader } from "./components/dashboard-headers";

const registerHeaders = (ctx: WorkbenchModuleContributionContext) => {
  ctx.layout.registerWidget(
    {
      id: dashboardWidgetIds.header,
      title: "Dashboard header",
      area: "nav",
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
    id: dashboardWidgetIds.leftHeader,
    title: "Project brand",
    area: "left-header",
    singleton: true,
    rendererId: dashboardWidgetIds.leftHeader,
    headerBorderBottom: false,
  });

  ctx.renderers.registerRenderer({
    id: dashboardWidgetIds.leftHeader,
    render: renderLeftHeaderContribution,
  });

  ctx.layout.openWidget(dashboardWidgetIds.header, { pinned: true });
  ctx.layout.openWidget(dashboardWidgetIds.leftHeader, { pinned: true });
};

export const createHeadersModule = () =>
  ({
    id: "dashboard.headers",
    activate(ctx) {
      registerHeaders(ctx);
    },
  }) satisfies WorkbenchModuleContribution;
