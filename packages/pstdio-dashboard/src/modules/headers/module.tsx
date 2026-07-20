import type { WorkbenchModuleContribution, WorkbenchModuleContributionContext } from "@pstdio/workbench/core";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { renderSidebarHeaderContribution } from "@/shared/workbench/contributions/header-contributions";

const registerHeaders = (ctx: WorkbenchModuleContributionContext) => {
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

  ctx.layout.openWidget(dashboardWidgetIds.sidebarHeader, { pinned: true });
};

export const createHeadersModule = () =>
  ({
    id: "dashboard.headers",
    activate(ctx) {
      registerHeaders(ctx);
    },
  }) satisfies WorkbenchModuleContribution;
