import type { WorkbenchModuleContribution, WorkbenchModuleContributionContext } from "@pstdio/workbench/core";
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

  ctx.renderers.registerRenderer({
    id: "left-header",
    render: renderLeftHeaderContribution,
  });

  const openHeaders = () => {
    ctx.layout.openWidget(dashboardWidgetIds.header, { pinned: true });
  };

  openHeaders();
  ctx.layout.onDidChangePersistenceScope((_scope, owners) => {
    if (owners.includes("project")) openHeaders();
  });
};

export const createHeadersModule = () =>
  ({
    id: "dashboard.headers",
    activate(ctx) {
      registerHeaders(ctx);
    },
  }) satisfies WorkbenchModuleContribution;
